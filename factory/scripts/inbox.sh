#!/usr/bin/env bash
# What the Factory Console has sent in. Read this at the start of every run,
# before deciding anything.
#
#   inbox.sh            show open requests and ideas
#   inbox.sh --done N "reply"   close issue N with a reply
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-oliverinhalo/Claude}"

if [ "${1:-}" = "--done" ]; then
  N="${2:?issue number required}"
  REPLY="${3:?a reply is required — say what you actually did}"
  gh api -X POST "repos/$REPO/issues/$N/comments" -f body="$REPLY

---
_Handled by the factory. [Run log](https://github.com/$REPO/actions)_" >/dev/null
  gh api -X PATCH "repos/$REPO/issues/$N" -f state=closed -f state_reason=completed >/dev/null
  echo "closed #$N"
  exit 0
fi

show() {
  local label="$1" json="$2"
  local count
  count="$(jq 'length' <<<"$json")"
  echo
  printf '\033[1m%s (%s)\033[0m\n' "$label" "$count"
  [ "$count" -eq 0 ] && { echo "  none"; return; }
  jq -r '.[] | "  #\(.number)  \(.title)\n      \((.body // "") | split("\n")[0] | .[0:140])\n      opened \(.created_at)\(if (.labels // []) | map(.name) | index("next") then "  [BUILD NEXT]" else "" end)"' <<<"$json"
}

REQUESTS="$(gh api "repos/$REPO/issues?labels=request&state=open&per_page=50" 2>/dev/null || echo '[]')"
IDEAS="$(gh api "repos/$REPO/issues?labels=idea&state=open&per_page=50" 2>/dev/null || echo '[]')"

echo "Inbox from the Factory Console"
echo "=============================="
show "Instructions — act on these first" "$REQUESTS"
show "Ideas submitted by the owner" "$IDEAS"
cat <<'NOTE'

Rules
  · Instructions outrank everything, including the phase you were about to start.
  · An idea labelled BUILD NEXT is this run's app, provided it clears the
    disqualifiers in references/idea-rubric.md. If it cannot be built, say why
    on the issue rather than silently choosing something else.
  · Close every issue you act on, with a reply saying what you actually did:
      factory/scripts/inbox.sh --done <number> "<what you did>"
  · An instruction you decide not to follow still gets a reply explaining why.
    Never leave one unanswered.
NOTE
