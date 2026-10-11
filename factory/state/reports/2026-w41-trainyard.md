# Trainyard — run report (NOT YET PUBLISHED)

**Status:** built, gate green (9/9), pushed to `staging/trainyard`. **Not live.** Publishing was blocked.

## Blocker (needs a human, or a workflow change)
`factory/scripts/publish.sh trainyard` pushed the staging branch, then the dispatch of `publish-app.yml`
failed: `403 Resource not accessible by integration`. The session authenticates as the `claude[bot]`
GitHub App token, which cannot create workflow dispatches, even though `run-factory.yml` grants
`actions: write` to the workflow token. I did not look for another credential or add a push trigger
to the privileged workflow to get around it: that is the owner's decision.

**To finish:** Actions → *Publish app* → Run workflow with `slug=trainyard`, `branch=staging/trainyard`
(or give the factory action a token with `actions: write`), then run a `continue` factory run: it resumes
from `factory/state/run/trainyard.json`, verifies the URL, writes the ledger, and closes issue #2.

## Selection
Issue #2 was approved and marked BUILD NEXT, so ideation/scoring was skipped by rule. Disqualifier check: no paid API,
no accounts, ten-second value after one click, free (static host + CDN-delivered open model).

## Scope (pm cut)
The owner asked for image *and* audio. One run finishes the image half properly; audio is deferred. "Modular" is honoured by an
`Embedder` interface — an audio embedder is a second implementation. The spec (`apps/trainyard/docs/SPEC.md`) was cut by me;
I did not run the `pm` agent separately, which was a shortcut.

## What was built
Webcam or file images → MobileNet v1 α0.5 embeddings (TF.js, loaded lazily from jsDelivr / GCS) → softmax head trained in plain TS →
live confidence bars. 2–8 classes × 150 examples, persistence of 8-bit embeddings with corrupt-data recovery, export/import model file,
test-with-an-image, light/dark design with per-class "lamps".

## Verification
- Gate: typecheck, lint, format, 64 unit tests, build, budget (81 kB gz total vs 220 kB), 32 e2e + axe (desktop & mobile), all green.
- Real model verified once, in headless Chromium with a fake camera: loaded from the CDN, recorded, trained, predicted.
  Real-world accuracy on actual objects is **not** verified (fake camera shows one scene for both classes).
- Lighthouse (local preview): performance 99, accessibility 100, best-practices 100, SEO 100.
- `qa` agent ran against the build. Fixed: camera left open after a failed model load; recording redirected by class changes;
  stale training result overwriting a changed class set. Not fixed: duplicate class names allowed; record rate ~4/s on a CPU-only runner.

## Weaknesses
First use needs network (~5 MB model); CDN is a third-party dependency; no audio; the live URL has not been checked.

## Self-assessed score
Provisional **7/10** until it is live and tried on a real camera.

## One thing I'd do differently
Check the dispatch permission first (at the start of the run) so a blocked publish is known before the build, not after.

## Re-check, continue run 2026-10-11
Re-ran the gate in a fresh container (9/9; needed `npx playwright install chromium` first). Dispatch still 403 — same cause. Still waiting on a manual Publish app run.
