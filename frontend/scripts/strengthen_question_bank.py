#!/usr/bin/env python3
"""Replace giveaway distractors with plausible PMP decision alternatives.

The answer keys and authored rationales are unchanged. Replacements are exact
and deterministic so content review can audit every affected option.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

REPLACEMENTS = {
    "Continue delivery and postpone the alignment discussion until project closure.": "Continue delivery while logging the disagreement for decision at the next scheduled governance review.",
    "Escalate the disagreement immediately without first clarifying the underlying assumptions.": "Send the stated positions and current impact assessment to the sponsor for a prioritization decision.",
    "Publish the existing vision again and require stakeholders to comply without discussion.": "Reissue the approved vision and ask functional leads to align their local priorities to it.",
    "Use the same development approach for every component regardless of uncertainty or constraints.": "Apply the organization's standard lifecycle to every component to maintain consistent governance.",
    "Ignore declining usage because the schedule and budget remain within baseline.": "Keep the current delivery plan while tracking adoption as an operational measure after release.",
    "Prioritize the request from the most senior stakeholder without comparing outcomes.": "Give the senior stakeholder's request precedence because that stakeholder owns the largest organizational risk.",
    "Ignore incentives that reward the old behavior.": "Focus the transition plan on training and communications before changing performance incentives.",
    "Accept private sponsor support without visible leadership action.": "Use the sponsor's private commitment to authorize the change while team leads handle visible reinforcement.",
    "Treat resistance as a communication failure without investigating causes.": "Increase the frequency of change communications and monitor whether resistance declines.",
    "Focus only on the sponsor because the sponsor has the most formal authority.": "Use the sponsor as the primary stakeholder channel and have the sponsor cascade decisions to other groups.",
    "Ignore supplier financial risk until a delivery is actually missed.": "Retain the approved supplier plan and review financial exposure at the next procurement performance meeting.",
    "Deploy an AI model without bias testing or human oversight.": "Release the model within the existing pilot controls and schedule additional assurance work during stabilization.",
    "Keep risks as an unprioritized list without owners or responses.": "Maintain the current risk register and discuss response ownership during the next monthly risk review.",
    "Treat every risk with the same response regardless of tolerance or cost effectiveness.": "Apply the organization's standard risk response to all threats for consistency and auditability.",
    "Change the schedule baseline without the required authorization.": "Update the working schedule to the forecast dates and seek formal baseline approval at the next control meeting.",
    "Fast track every activity regardless of dependency or risk.": "Overlap all remaining activities that have available resources to protect the committed date.",
    "Add more governance meetings without defining decisions or owners.": "Increase governance meeting frequency so emerging decisions receive broader leadership visibility.",
    "Estimate large backlog items without decomposing them.": "Use relative estimation for the large backlog items and refine them when they enter the next iteration.",
    "Treat an approved change as complete without updating plans or execution.": "Record the approval in the change log and let workstream leads incorporate it through normal planning.",
    "Implement the request immediately and document it after delivery.": "Begin the requested work using management reserve while the formal change record is prepared.",
    "Correct each repeated defect without investigating its source.": "Increase inspection and rework capacity until the defect rate returns to the control threshold.",
    "Copy a competitor feature without assessing strategy, value, or risk.": "Add the competitor feature to the near-term roadmap to protect market parity, then validate its benefits after release.",
    "Move the disputed work to a later phase without resolving the relationship or decision issue.": "Defer the disputed scope to a later release and preserve the present working agreement so delivery can continue.",
    "Keep unused report sections because the template has always included them.": "Retain the complete governance template so all audiences receive a consistent reporting package.",
    "Give every audience the same level of detail regardless of its decisions.": "Publish one consolidated status report to preserve a single authoritative version for all stakeholders.",
    "Use final inspection as the only quality activity.": "Concentrate quality resources on acceptance inspection because it directly determines deliverable approval.",
    "Ignore a point outside control limits because the average is acceptable.": "Continue monitoring the process until a second out-of-control point confirms a special cause.",
    "Transfer unresolved critical defects to operations without agreement.": "Complete the planned transition and track unresolved defects through the operational support backlog.",
    "Require overtime in every week without analyzing priorities.": "Authorize a sustained overtime window across the team to protect the approved milestone.",
    "Close a risk after a response is planned without monitoring triggers or residual exposure.": "Mark the risk response as implemented and move any remaining exposure to routine status reporting.",
    "Select a delivery approach only because the organization used it on the last project.": "Reuse the organization's proven delivery approach to reduce process adoption risk for the team.",
    "Choose the option with the most features regardless of learning or risk.": "Select the feature-rich option because it preserves the broadest range of future business choices.",
    "Measure leadership effectiveness only by the number of tasks completed.": "Use completed work and throughput as the primary evidence that the leadership approach is effective.",
    "Wait for the sponsor to notice the team's impediment.": "Keep the impediment with the team and include it in the next routine sponsor status report.",
    "Use the same change approach regardless of organizational culture.": "Apply the enterprise change framework consistently so adoption reporting remains comparable.",
    "Avoid the issue and wait for the team to resolve it without support.": "Give the team another iteration to resolve the issue through its working agreement before intervening.",
    "Send a general reminder about professionalism without addressing the specific conflict.": "Reinforce the team's code of conduct at the next retrospective and monitor behavior afterward.",
    "Ask the departing specialist to upload files without validating understanding.": "Require the specialist to complete the knowledge repository and make the functional manager accountable for later questions.",
    "Use backlog authority to alter regulated milestones or contracts without approval.": "Reorder the backlog to absorb the milestone change, then update regulated commitments in the next release plan.",
    "Combine all reserves so the project manager can use them without approval.": "Pool contingency and management reserves in one forecast to simplify response funding decisions.",
    "Report current spend as the final forecast without analyzing remaining work.": "Use current spend plus the original remaining budget as the forecast until the next formal estimate cycle.",
    "Use scope completion as the only measure of value.": "Use accepted scope as the primary benefits proxy because it is objective and available throughout delivery.",
    "Use the same leadership style regardless of team maturity or context.": "Maintain one leadership style so expectations remain predictable while the team develops.",
    "Analyze cost, schedule, quality, and value separately without reconciling implications.": "Let each control owner optimize its own measure and consolidate the resulting reports for governance.",
    "Accept supplier work without required sustainability or compliance evidence.": "Accept the technically conforming work conditionally and collect the outstanding assurance evidence before final payment.",
    "Use the sponsor's opinion as the only acceptance criterion.": "Treat sponsor approval as the primary acceptance evidence because the sponsor owns the business case.",
    "Use activity counts as the only project-status measure.": "Use completed activity counts as the primary status indicator because they are easy to verify across teams.",
    "Rebaseline the budget immediately whenever a variance appears.": "Propose a budget rebaseline at the next control cycle so future reporting reflects current performance.",
    "Enter negotiation without agreed objectives or walk-away limits.": "Begin exploratory negotiation to discover the supplier's position before establishing the project's final limits.",
    "Ignore the external change until it has already caused a project variance.": "Keep the approved baseline and monitor the external change through environmental scanning until its impact is measurable.",
    "Choose the cheapest sourcing option without considering control, risk, or support.": "Select the lowest compliant bid and manage service and control concerns through the contract after award.",
    "Force a decision based only on the project manager's positional authority.": "Use the project manager's delegated authority to settle the issue and preserve the delivery schedule.",
    "Ignore prior lessons because every project is unique.": "Rely on the current team's experience and consult prior lessons only after the first planning baseline is complete.",
    "Promise the requested feature immediately to preserve the relationship.": "Give the stakeholder a provisional commitment and have the team fit the feature into the next iteration.",
    "Record the lesson without assigning an action or owner.": "Publish the lesson in the repository and let future project managers decide whether it applies to their context.",
    "Measure improvement only by whether the team likes the new process.": "Use team sentiment as the primary adoption measure during the first improvement cycle.",
    "Ignore a dependent project's milestone because it is outside the project boundary.": "Keep the dependency in the assumptions log and let the other project report any material schedule change.",
    "Ask the sponsor to select a feature without first agreeing on the outcome it should support.": "Present the feature alternatives to the sponsor and ask for a selection based on executive judgment.",
    "Escalate without explaining impact, urgency, or the decision needed.": "Forward the issue log entry to governance and request guidance at the next scheduled meeting.",
    "Continue temporary fixes without investigating recurrence.": "Standardize the temporary fix as an operating procedure while monitoring the recurrence rate.",
    "Transfer the solution to operations without ownership or staffing agreements.": "Complete the technical handoff and allow operations management to resolve ownership and staffing through normal planning.",
    "Ignore inflation or exchange exposure until the invoice is received.": "Use the contracted amount in the forecast and recognize currency or inflation variance when invoiced.",
    "Measure success only by the percentage of scope completed.": "Use accepted scope percentage as the primary success measure because it is traceable to the approved baseline.",
    "Ignore positive risks and opportunities until they happen.": "Track opportunities in the watch list and invest response funds after their probability rises.",
    "Select a contract type only because it was used on the previous project.": "Reuse the previous contract structure because procurement and the supplier already understand its controls.",
    "Judge vendor performance without reference to contract measures or acceptance criteria.": "Use stakeholder satisfaction and delivery cadence as the main vendor performance indicators.",
    "Produce every requested report without checking its decision value.": "Keep all requested reports in the communication plan so stakeholder expectations remain satisfied.",
    "Ignore recurring operational interruptions when forecasting capacity.": "Use the team's nominal capacity and account for operational interruptions as iteration variances.",
    "Add headcount without checking whether the required skill is present.": "Increase team capacity with available internal staff and address skill gaps through on-the-job pairing.",
    "Use more communication channels without defining ownership or a source of truth.": "Add the stakeholder's preferred channels and synchronize them during routine status preparation.",
    "Escalate every issue regardless of impact or threshold.": "Send all open issues to governance so decision makers can determine which ones require intervention.",
    "Reject the request without exploring the underlying stakeholder need.": "Decline the request against the current baseline and invite the stakeholder to submit it in the next planning cycle.",
    "Assume the path with the most activities is always the critical path.": "Use the longest sequence by activity count as the initial critical path and validate it during schedule review.",
    "Create separate workstream plans without reconciling dependencies or assumptions.": "Let workstream leads optimize their local plans and reconcile conflicts during monthly integration reviews.",
    "Measure adoption only by whether the system was installed.": "Use successful installation as the primary adoption milestone and measure behavior change after transition.",
    "Measure project success only by schedule and budget performance.": "Use schedule and budget performance as the primary success measures reported to governance.",
    "Address only the supplier contract and leave the team blocked.": "Resolve the supplier's contractual accountability first, then address the team's workaround in the next planning cycle.",
    "Change the process without defining a measure or baseline.": "Pilot the process change based on qualitative feedback and establish measures after the team has experience with it.",
}

SUPPORTED_FORMATS = {
    "Case or scenario",
    "Graphic-based",
    "Multiple-choice single response",
    "Multiple-response",
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("bank", type=Path)
    args = parser.parse_args()
    payload = json.loads(args.bank.read_text(encoding="utf-8"))
    changed = 0
    for form in payload["forms"].values():
        for question in form["questions"]:
            if question["qformat"] not in SUPPORTED_FORMATS:
                continue
            correct = {code.strip() for code in question["correct"].split(",")}
            for index, option in enumerate(question["options"]):
                if chr(65 + index) in correct or option not in REPLACEMENTS:
                    continue
                question["options"][index] = REPLACEMENTS[option]
                changed += 1
    args.bank.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"Strengthened {changed} distractor placements using {len(REPLACEMENTS)} reviewed replacements")


if __name__ == "__main__":
    main()
