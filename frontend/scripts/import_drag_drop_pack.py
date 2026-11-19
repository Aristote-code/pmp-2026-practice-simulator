#!/usr/bin/env python3
"""Convert the user-supplied drag-and-drop PDF into simulator drill JSON.

Requires Poppler's pdftotext command. The generated file deliberately records
the source pack and page numbers so it is never presented as official PMI copy.
"""

from __future__ import annotations

import argparse
import itertools
import json
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

NS = {"x": "http://www.w3.org/1999/xhtml"}
CLASSIFICATION_QUESTIONS = {85, 86, 90, 91, 107}
SPECIAL_CHOICES = {
    107: [
        "Variable Cost",
        "Fixed Cost",
        "Servant Leadership",
        "Directing Leadership",
        "Prefer written communication",
        "Prefer face-to-face communication",
        "Requirements defined at beginning",
        "Requirements progressively elaborated",
    ]
}


def clean(value: str) -> str:
    replacements = {
        "\u201c": '"',
        "\u201d": '"',
        "\u2019": "'",
        "\u2013": "-",
        "\u2014": "-",
        "\u2026": "...",
    }
    for source, replacement in replacements.items():
        value = value.replace(source, replacement)
    return re.sub(r"\s+", " ", value).strip()


def token(value: str) -> str:
    return re.sub(r"[^a-z0-9%+\-]", "", value.lower())


def blocks(page: ET.Element) -> list[dict[str, float | str]]:
    result = []
    for block in page.findall(".//x:block", NS):
        text = clean(" ".join("".join(word.itertext()).strip() for word in block.findall(".//x:word", NS)))
        if text:
            result.append(
                {
                    "text": text,
                    "x0": float(block.get("xMin", "0")),
                    "x1": float(block.get("xMax", "0")),
                    "y0": float(block.get("yMin", "0")),
                    "y1": float(block.get("yMax", "0")),
                }
            )
    return result


def words(page: ET.Element) -> list[dict[str, float | str]]:
    result = []
    for word in page.findall(".//x:word", NS):
        text = clean("".join(word.itertext()))
        if text and token(text):
            result.append(
                {
                    "text": text,
                    "x0": float(word.get("xMin", "0")),
                    "x1": float(word.get("xMax", "0")),
                    "y0": float(word.get("yMin", "0")),
                    "y1": float(word.get("yMax", "0")),
                }
            )
    return result


def occurrences(page: ET.Element, phrase: str) -> list[dict[str, float]]:
    page_words = words(page)
    expected = [token(part) for part in phrase.split() if token(part)]
    matches = []
    for index in range(len(page_words) - len(expected) + 1):
        segment = page_words[index : index + len(expected)]
        if [token(str(item["text"])) for item in segment] != expected:
            continue
        matches.append(
            {
                "x0": min(float(item["x0"]) for item in segment),
                "x1": max(float(item["x1"]) for item in segment),
                "y0": min(float(item["y0"]) for item in segment),
                "y1": max(float(item["y1"]) for item in segment),
            }
        )
    return matches


def center(item: dict[str, float | str], axis: str) -> float:
    return (float(item[f"{axis}0"]) + float(item[f"{axis}1"])) / 2


def choice_occurrences(answer_page: ET.Element, choices: list[str]) -> list[tuple[int, dict[str, float]]]:
    choice_indexes: dict[str, list[int]] = defaultdict(list)
    labels: dict[str, str] = {}
    for index, label in enumerate(choices):
        key = " ".join(token(part) for part in label.split() if token(part))
        choice_indexes[key].append(index)
        labels[key] = label

    result = []
    for key, indexes in choice_indexes.items():
        unique = {}
        for match in occurrences(answer_page, labels[key]):
            if center(match, "x") <= 350 or float(match["y0"]) <= 100 or float(match["y1"]) >= 605:
                continue
            signature = tuple(round(match[field], 1) for field in ("x0", "x1", "y0", "y1"))
            unique[signature] = match
        ordered = sorted(unique.values(), key=lambda item: (float(item["y0"]), float(item["x0"])))
        for choice_index, match in zip(indexes, ordered):
            result.append((choice_index, match))
    return result


def assign_one_to_one(
    targets: list[dict[str, float | str]],
    placed_choices: list[tuple[int, dict[str, float]]],
) -> dict[int, int]:
    if len(placed_choices) < len(targets):
        raise ValueError(f"Only found {len(placed_choices)} placed choices for {len(targets)} targets")

    def cost(target: dict[str, float | str], placement: dict[str, float]) -> float:
        horizontal = abs(center(target, "x") - center(placement, "x"))
        expected_y = float(target["y1"]) + 10
        vertical = abs(float(placement["y0"]) - expected_y)
        return horizontal * 0.4 + vertical

    best_cost = float("inf")
    best: tuple[tuple[int, dict[str, float]], ...] | None = None
    for candidate in itertools.permutations(placed_choices, len(targets)):
        candidate_cost = sum(cost(target, placement) for target, (_, placement) in zip(targets, candidate))
        if candidate_cost < best_cost:
            best_cost = candidate_cost
            best = candidate
    if best is None:
        raise ValueError("Unable to assign matching targets")
    return {target_index: choice_index for target_index, (choice_index, _) in enumerate(best)}


def build_question(number: int, question_page: ET.Element, answer_page: ET.Element) -> dict[str, object]:
    question_blocks = blocks(question_page)
    title = re.sub(r"^Question\s+\d+:\s*", "", str(question_blocks[0]["text"]))
    choices = SPECIAL_CHOICES.get(number) or [
        str(block["text"])
        for block in question_blocks
        if float(block["x1"]) < 380 and float(block["y0"]) > 100 and float(block["y1"]) < 560
    ]
    right_blocks = [
        block
        for block in question_blocks
        if float(block["x0"]) > 280 and float(block["y0"]) > 95 and float(block["y1"]) < 560
    ]
    classification = number in CLASSIFICATION_QUESTIONS
    targets = [block for block in right_blocks if float(block["y0"]) < 180] if classification else right_blocks
    placed = choice_occurrences(answer_page, choices)

    choice_rows = [{"id": f"C{index + 1}", "label": label} for index, label in enumerate(choices)]
    target_rows = []
    correct: dict[str, list[str]] = {}
    if classification:
        for index, target in enumerate(targets):
            target_id = f"T{index + 1}"
            assigned = sorted(
                (
                    (choice_index, placement)
                    for choice_index, placement in placed
                    if min(range(len(targets)), key=lambda item: abs(center(placement, "x") - center(targets[item], "x"))) == index
                ),
                key=lambda item: float(item[1]["y0"]),
            )
            correct[target_id] = [f"C{choice_index + 1}" for choice_index, _ in assigned]
            target_rows.append({"id": target_id, "prompt": str(target["text"]), "capacity": len(assigned)})
    else:
        assignment = assign_one_to_one(targets, placed)
        for index, target in enumerate(targets):
            target_id = f"T{index + 1}"
            correct[target_id] = [f"C{assignment[index] + 1}"]
            target_rows.append({"id": target_id, "prompt": str(target["text"]), "capacity": 1})

    used = {choice_id for values in correct.values() for choice_id in values}
    if not targets or not choices or any(not values for values in correct.values()):
        raise ValueError(f"Question {number} has an incomplete interaction")
    if len(used) != sum(len(values) for values in correct.values()):
        raise ValueError(f"Question {number} reuses a choice placement")

    pairings = []
    labels_by_id = {row["id"]: row["label"] for row in choice_rows}
    for target in target_rows:
        labels_for_target = ", ".join(str(labels_by_id[choice_id]) for choice_id in correct[str(target["id"])])
        pairings.append(f"{target['prompt']}: {labels_for_target}")

    return {
        "id": number,
        "title": title,
        "instruction": "Drag every required answer tile to its matching target. One or more choices may be unused.",
        "choices": choice_rows,
        "targets": target_rows,
        "correct": correct,
        "rationale": "Correct placements: " + "; ".join(pairings) + ".",
        "source": "User-supplied David McLachlan drag-and-drop practice pack; independent practice material, not an official PMI exam item.",
        "source_pages": [5 + (number - 1) * 2, 6 + (number - 1) * 2],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if not args.pdf.exists():
        raise SystemExit(f"PDF not found: {args.pdf}")

    with tempfile.TemporaryDirectory() as directory:
        xml_path = Path(directory) / "pack.xml"
        subprocess.run(["pdftotext", "-bbox-layout", str(args.pdf), str(xml_path)], check=True)
        pages = ET.parse(xml_path).getroot().findall(".//x:page", NS)
    if len(pages) < 224:
        raise SystemExit(f"Expected at least 224 PDF pages, found {len(pages)}")

    drills = [build_question(number, pages[4 + (number - 1) * 2], pages[5 + (number - 1) * 2]) for number in range(1, 111)]
    payload = {
        "title": "110 Drag & Drop Questions",
        "schema_version": "1.0",
        "disclaimer": "User-supplied independent practice material. Not affiliated with or endorsed by PMI or Pearson VUE.",
        "questions": drills,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"Wrote {len(drills)} validated drills to {args.output}")


if __name__ == "__main__":
    main()
