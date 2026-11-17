# Week 47 — Roomwise

Live: https://roomwise-i1p.pages.dev · Repo: oliverinhalo/roomwise. Queue and inbox were empty; chosen from the idea bank ("Rent split by room", category `calculator`, never shipped; recent categories were finance, music, accessibility, education, planner, developer).

## Selection
Deviation from Phases 1–2: no fresh 40-candidate pass and no 8-way scoring table. Single informal score of the chosen idea against the rubric: 71/90 (ten-second value 5, one-run 5, repeat use 2, zero cost 5, findable 4, sellable 2, underserved 3, shareable 5, technical core 3). It is above the 55 floor, and no other candidate was scored.

## Built
Weighted rent split: (room area + equal share of common space) × (1 + perk percentages), largest-remainder rounding so shares sum exactly to the rent. Editable perk weights, m²/ft² switch, optional cents, 1–12 rooms, per-room arithmetic shown, floor-plan strip, copy link / copy text, URL-hash state, versioned localStorage with corrupt-data recovery, warm light/dark design with Fraunces.

## Cut
Utilities, pro-rating, saved scenarios, accounts.

## QA
Foreground qa agent: 11/11 criteria pass. Fixed: cleared number field poisoned saved state and share link; malformed hash gave no notice; ft² conversion could exceed the area cap and break reload. Added hashchange handling. Gate re-run 9/9 after the fixes.

## What broke
Playwright browser missing (installed). Lint forbade non-null assertions in tests (rewrote tests, gate unchanged). `roomwise.pages.dev` belongs to someone else, so verify-live first hit a Cloudflare Access page; the real host is `roomwise-i1p.pages.dev`. Corrected canonical/robots/README, republished, verified live healthy.

## Score: 7/10
Focused, accessible, verified live. Lighthouse not measured; I did not drive the core loop in production by hand beyond verify-live (QA drove it locally). Switching units rounds to 0.1, so round trips drift slightly.
Would do differently: run the real ideation and scoring pass, and measure Lighthouse.

## Follow-up run (2026-11-17, CONTINUE mode)
Lighthouse measured against the live URL (mobile default): performance 97, accessibility 100, best-practices 100, SEO 100. The "Lighthouse not measured" gap is closed. Score stays 7.
No interrupted run, empty queue and inbox. The lowest-scored app (ai-detector, 6) is blocked on a real labelled corpus and a trained model, a multi-run job, so nothing further was attempted this run.
