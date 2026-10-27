#!/usr/bin/env bash
# The build order. Position 1 is what the next run builds.
#
#   queue.sh                 show the queue
#   queue.sh --next          print position 1 as JSON, or nothing when empty
#   queue.sh --done <id>     remove an item once it has shipped, and commit
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FILE="$ROOT/factory/state/queue.json"

[ -f "$FILE" ] || printf '{\n  "version": 1,\n  "items": []\n}\n' > "$FILE"

if ! jq -e . "$FILE" >/dev/null 2>&1; then
  echo "ERROR: $FILE is not valid JSON — the console may have written it mid-edit." >&2
  echo "       Fix it by hand before building anything; do not guess the order." >&2
  exit 1
fi

case "${1:-show}" in
  --next)
    jq -e '.items[0] // empty' "$FILE" 2>/dev/null || true
    ;;

  --done)
    ID="${2:?item id required}"
    jq --arg id "$ID" '.items |= map(select(.id != $id)) | .updated = (now | todate)' \
      "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
    git -C "$ROOT" add factory/state/queue.json
    git -C "$ROOT" diff --cached --quiet factory/state/queue.json \
      || git -C "$ROOT" -c commit.gpgsign=false commit -q -m "queue: $ID is built, removing it"
    echo "removed $ID from the queue"
    ;;

  *)
    COUNT="$(jq '.items | length' "$FILE")"
    echo
    printf '\033[1mBuild queue (%s)\033[0m\n' "$COUNT"
    if [ "$COUNT" -eq 0 ]; then
      echo "  empty — no one has asked for anything, so choose your own idea this run"
    else
      jq -r '.items | to_entries[] |
        "  \(.key + 1). \(.value.title)   [\(.value.source)\(if .value.issue then " #\(.value.issue)" else "" end)]" +
        (if (.value.brief.purpose // "") != "" then "\n        \(.value.brief.purpose)" else "" end) +
        (if ((.value.brief.mustHave // []) | length) > 0
          then "\n        MUST HAVE (contract — build every one):\n" +
               ((.value.brief.mustHave | map("          · " + .) | join("\n")))
          else "" end) +
        (if ((.value.brief.exclude // []) | length) > 0
          then "\n        DO NOT INCLUDE:\n" +
               ((.value.brief.exclude | map("          · " + .) | join("\n")))
          else "" end) +
        "\n        id: \(.value.id)"' "$FILE"
      cat <<'NOTE'

  Position 1 is this run's app. Build it, then:
      factory/scripts/queue.sh --done <id>
  Do not reorder the queue yourself and do not skip position 1 — the owner set
  this order in the console. If position 1 genuinely cannot be built, say why
  on its issue (or in the run report when it has none), leave it in place, and
  stop rather than quietly building something else.
NOTE
    fi
    ;;
esac
