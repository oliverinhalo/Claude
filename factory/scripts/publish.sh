#!/usr/bin/env bash
# Publish an app: push its staging branch and dispatch the privileged publisher
# workflow, which creates the app's own repository and deploys it.
#   publish.sh <slug> [--watch]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SLUG="${1:?usage: publish.sh <slug> [--watch]}"
WATCH="${2:-}"
REPO="${GITHUB_REPOSITORY:-oliverinhalo/Claude}"
BRANCH="staging/$SLUG"
WORKFLOW="publish-app.yml"

[ -d "$ROOT/apps/$SLUG" ] || { echo "apps/$SLUG does not exist" >&2; exit 1; }

echo "── gate"
"$ROOT/factory/scripts/quality-gate.sh" "$ROOT/apps/$SLUG" \
  || { echo "refusing to publish: the gate failed" >&2; exit 1; }

echo "── push $BRANCH"
cd "$ROOT"
git add -A
git diff --cached --quiet || git commit -m "release: $SLUG ready to publish"
git push -f origin "HEAD:$BRANCH"

echo "── dispatch $WORKFLOW"
gh api -X POST "repos/$REPO/actions/workflows/$WORKFLOW/dispatches" \
  -f ref="$(git rev-parse --abbrev-ref HEAD)" \
  -f "inputs[slug]=$SLUG" \
  -f "inputs[branch]=$BRANCH"
echo "dispatched."

[ "$WATCH" = "--watch" ] || { echo "poll with: $0 $SLUG --watch"; exit 0; }

echo "── watching"
# Identify the run by the commit just pushed. Polling ?per_page=1 returns
# whatever run is newest at that instant, which in the seconds before the new one
# registers is the PREVIOUS run — so a stale success or failure gets reported as
# this one's. Cost me a wrong diagnosis once already.
SHA="$(git rev-parse HEAD)"
RUN_ID=""
for _ in $(seq 1 24); do
  RUN_ID="$(gh api "repos/$REPO/actions/workflows/$WORKFLOW/runs?head_sha=$SHA&per_page=1" \
    -q '.workflow_runs[0].id' 2>/dev/null || true)"
  [ -n "$RUN_ID" ] && [ "$RUN_ID" != "null" ] && break
  sleep 5
done
if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "could not find a workflow run for $SHA — check $REPO/actions" >&2
  exit 1
fi
echo "run $RUN_ID → https://github.com/$REPO/actions/runs/$RUN_ID"

STATUS=""; CONCLUSION=""
for _ in $(seq 1 180); do
  read -r STATUS CONCLUSION <<<"$(gh api "repos/$REPO/actions/runs/$RUN_ID" \
    -q '.status + " " + (.conclusion // "-")' 2>/dev/null || echo "unknown -")"
  [ "$STATUS" = "completed" ] && break
  printf '.'; sleep 10
done
echo

if [ "${CONCLUSION:-}" = "success" ]; then
  echo "── published"
  gh api "repos/$REPO/actions/runs/$RUN_ID/jobs" -q '.jobs[].steps[] | select(.name|test("summary|url";"i")) | .name' 2>/dev/null || true
  echo "verify the live URL yourself before touching the ledger:"
  echo "  cd apps/$SLUG && node ../../factory/scripts/verify-live.mjs <url>"
  exit 0
fi

echo "── FAILED ($CONCLUSION). Logs follow — this is yours to fix." >&2
gh api "repos/$REPO/actions/runs/$RUN_ID/jobs" -q '.jobs[] | select(.conclusion=="failure") | .id' \
  | while read -r JOB; do gh api "repos/$REPO/actions/jobs/$JOB/logs" 2>/dev/null | tail -80; done
exit 1
