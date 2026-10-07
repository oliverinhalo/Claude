#!/usr/bin/env bash
# Record run progress so an interrupted session resumes instead of restarting.
#   checkpoint.sh <slug> <phase> <status> ["next action"]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SLUG="${1:?slug required}"
PHASE="${2:?phase required}"
STATUS="${3:-in_progress}"
NEXT="${4:-}"
FILE="$ROOT/factory/state/run/$SLUG.json"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ ! -f "$FILE" ]; then
  WEEK="$(( $(jq '.apps | length' "$ROOT/factory/state/ledger.json") + 1 ))"
  jq -n --arg s "$SLUG" --argjson w "$WEEK" --arg now "$NOW" \
    '{slug:$s, week:$w, status:"in_progress", started:$now, updated:$now,
      last_completed_phase:null, next_action:"", decisions:[], blockers:[], live_url:null}' \
    > "$FILE"
fi

jq --arg p "$PHASE" --arg st "$STATUS" --arg n "$NEXT" --arg now "$NOW" \
  '.last_completed_phase = $p
   | .status = $st
   | .updated = $now
   | if $n != "" then .next_action = $n else . end' \
  "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"

echo "checkpoint: $SLUG — $PHASE ($STATUS)"
[ -n "$NEXT" ] && echo "next: $NEXT"
exit 0
