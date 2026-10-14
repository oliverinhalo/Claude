# Week 2 — Cronlens

Live: https://cronlens.pages.dev · Repo: oliverinhalo/cronlens · Self-score: **7/10**

## Selection
Inbox empty (no instructions, no approved ideas). 40 new candidates appended to the idea bank. Top 8 scored on the rubric (max 90); category `developer-tool` is new to the ledger (previous app: teaching-tool).

| Idea | Score |
|---|---|
| **Cronlens** (cron × DST) | 66 |
| Freelance rate floor | 62 |
| Rent split by room | 58 |
| ICS builder | 57 |
| Json to types | 54 (crowded) |
| Timezone-safe deadline | 54 |
| Sourdough schedule | 52 |
| Loan payoff snowball | 51 |

Scores are my own estimate, written after choosing; the deciding factor was a real technical core and an underserved question (crontab.guru does not model clock changes).

## Built
Five-field cron parser (Vixie day rule), zone arithmetic from `Intl` (no tz database), clock-change detection by scan and bisect, plain-English description, next ten runs, per-change strip, share by URL hash, local persistence with recovery. 125 unit tests, 27 browser tests incl. axe in both themes, zero network after load.

## Cut
Seconds/Quartz syntax, claims about how specific schedulers behave, multiple expressions, report export, service worker.

## What broke / was found
- Sandbox lacked Chromium for Playwright; fixed with `npx playwright install chromium` (no gate change).
- Gate found a footer link with no underline (contrast) and a scrollable table without keyboard access; both fixed.
- QA agent found: a 50,000-char paste echoed into the error message caused 450,000px horizontal scroll; hash changes in the same tab ignored; unknown link zone fell back to the wrong zone; plural/"Next 0 runs" copy. All fixed with tests.
- Architect review shaped the zone code (36 h offset sampling, 12 h scan step); fixtures for Lord Howe, Apia, Havana are in tests.

## Not done / honest gaps
- Lighthouse was not run this session. Playwright axe is clean; performance is unmeasured.
- Polish ladder partly climbed: hostile input, copy, SEO assets (OG image rendered, JSON-LD, sitemap), first-run example, README done. Offline is "no network needed after load", not a service worker.
- Cloudflare Pages was selected by the workflow; verified live (200, verify-live all green) and core loop driven in production.

## Signature detail
The clock-change strip. A decision that cost something: no scheduler-behaviour claims, only wall-clock facts.

## Do differently
Measure Lighthouse before publishing, and add a "suggest a safe time" fix, which is the thing users will ask for next.

## Continue run 2026-10-14
Built the "nearest safe time" suggestion (whole-hour shift of the hour field, never crossing midnight, verified hazard-free over the same 12-month window; one-click apply). 5 new unit tests, 1 new e2e test. Gate 9/9. Lighthouse measured on local preview: 95 / 100 / 100 / 100. Redeployed via the staging push; live URL verified (verify-live green, new bundle contains the feature).
Not done: suggestion only shifts the hour field (no minute shifts, no macros like `@daily`). Idea #3 (budgeter) is approved but not BUILD NEXT; left for a build run rather than starting a new app in CONTINUE mode.
