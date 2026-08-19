# PMP 2026 Practice Simulator

An independent practice application aligned to the PMP Examination Content Outline launched on July 9, 2026. It is not affiliated with or endorsed by PMI or Pearson VUE.

## Included

- Four original forms with 180 questions each
- 240-minute exam timer with refresh recovery
- Case-study section followed by independent questions
- Ten-minute breaks after questions 20 and 100
- Permanent section locks after each break
- Single response, multiple response, matching, enhanced matching, graphic, point-and-click, and pull-down interactions
- Flags, navigator, strikeout, highlighting, calculator, and notes
- Untimed learning mode with answer-by-answer correctness and AI explanations
- All-question learning navigator, unrestricted backtracking, and saved resume progress
- Strict timed simulation mode for full exam practice
- Exact answer-key scoring with ten hidden practice pretest positions
- Domain, delivery-approach, and item-format diagnostics
- Optional Groq coaching that explains answers without changing scores

## Run locally

```bash
npm install
npm --prefix frontend install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Verify

```bash
npm test
npm run build
npm run lint
```

## AI feedback

Set `GROQ_API_KEY` in the Netlify environment. The key is used only by `netlify/functions/pmp-feedback.mjs` and never enters the browser bundle. Without a key, the app returns the authored rationale.

## Scoring note

PMI does not publish a fixed passing percentage, and operational exam forms are psychometrically equated. Simulator reports are readiness estimates, not official pass/fail results.
