# Trainyard — run report

**Status:** live at <https://trainyard.pages.dev>. Gate green (9/9), verified in a
real browser — 200, its own title and description, renders, `h1` and `main`
present, no failed requests, clean console, no overflow at 320px. Ledger updated,
score 7/10.

## Blocker — resolved

The 403 was real and correctly diagnosed. Root cause: a run inside
`run-factory.yml` authenticates as the `claude[bot]` App token, which cannot
create a workflow dispatch regardless of the job's own `permissions:`. Declining
to hunt for another credential was the right call.

Fixed at the source rather than by handing the agent a broader token:
`publish-app.yml` now also triggers on a push to `staging/**` and derives the slug
from the branch name, so pushing the staging branch *is* the publish and needs no
credential the agent lacks. `publish.sh` still attempts an explicit dispatch for
the manual case and treats a 403 there as expected.

Separately, this run committed `factory/state/run/trainyard.json` with unresolved
git conflict markers — two of its own writes collided. The resume path reads that
file, so a malformed one silently breaks recovery. `checkpoint.sh` now moves an
unparseable checkpoint aside with a loud warning instead of failing obscurely, and
`preflight.sh` reports both unparseable checkpoints and any committed conflict
markers.

### The blocker as originally reported
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

## Continue run 2026-10-11 (later)
Live URL re-checked: 200. Ledger entry already present. Fixed the QA leftover where adding a class after deleting one could
duplicate a name (e.g. delete "Class 1", add → second "Class 2"); new names now take the first free "Class N". Gate 9/9.
Not redeployed: the fix is on main only; pushing `staging/trainyard` would republish. No unit test added for it. Audio remains deferred.

## Continue run 2026-10-15
Moved `freeClassName` into `dataset.ts` and added 3 unit tests (the earlier fix had none). Gate 9/9. Redeployed via `staging/trainyard`; verify-live green (200, title, h1/main, clean console, no 320px overflow), so the class-name fix is now live.
Not done: audio still deferred; real-camera accuracy unverified. Idea #3 (budgeter) is approved but not BUILD NEXT; left for a build run.
