# Week 46 — AI Detector

Live: https://ai-detector-5ir.pages.dev · Brief: queue item `q_uhflkdi4`, issue #7. Phases 1–2 skipped (queue decides).

## Built
Four in-browser detectors (rhythm, stock phrasing, formal register, personal voice) blended and smoothed into per-sentence probabilities; overall 0–100 score; three-strength highlighting; sensitivity slider; `n`/`p` navigation with reasons; .docx/.odt/.txt/.md/.html/.rtf input up to 100 MB via a dependency-free zip reader; overlapping 1,500-word sections (150 overlap) with progress and cancel. 78,600 words analyse in ~0.14 s in Node; QA saw 50k words in ~0.3 s in Chromium.

## Must-haves
Detect AI, large documents, highlight lines — all built.

## Deviations from the notes (said on issue #7 before building)
- "Use pre-made detectors": not done. Hosted detector APIs bill and would upload student text; the ensemble is my own heuristics, **not a trained model**. A transformers.js model is listed on the roadmap.
- "If it passes this, Turnitin should also pass": cannot be promised and the app says so. Accuracy was only checked on two hand-written samples, not a benchmark. Expect false positives on formal and non-native writing.

## QA
Foreground qa agent: 12/12 criteria pass. Fixed: duplicate tab stop, offline-reload claim reworded. Not covered: a 100,000-word browser run, >100 MB file. PDF unsupported.

## What broke
Playwright browser was missing (installed); publish chose `ai-detector-5ir.pages.dev`, so canonical/OG/sitemap were fixed and republished; one staging push was rejected and retried.

## Score: 6/10
Polished, private and fast, but detection quality is unvalidated heuristics. Lighthouse not measured. Would do differently: benchmark against labelled human/AI text before shipping, and add a real model.
