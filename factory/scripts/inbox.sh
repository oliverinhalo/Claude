#!/usr/bin/env bash
# What the Factory Console has sent in. Read this at the start of every run,
# before deciding anything.
#
#   inbox.sh                      show instructions, approved ideas, and what is pending
#   inbox.sh --done N "reply"     close issue N with a reply saying what you did
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

labels_of() { jq -r '[.labels[]?.name] | join(",")'; }

fetch() { gh api "repos/$REPO/issues?labels=$1&state=open&per_page=50" 2>/dev/null || echo '[]'; }

show() {
  local label="$1" json="$2" note="${3:-}"
  local count; count="$(jq 'length' <<<"$json")"
  echo
  printf '\033[1m%s (%s)\033[0m\n' "$label" "$count"
  [ -n "$note" ] && printf '  \033[2m%s\033[0m\n' "$note"
  [ "$count" -eq 0 ] && { echo "  none"; return; }
  jq -r '.[] | "  #\(.number)  \(.title)\n      \((.body // "") | split("\n")[0] | .[0:140])\n      opened \(.created_at)\(if ([.labels[]?.name] | index("next")) then "  [BUILD NEXT]" else "" end)  by @\(.user.login)"' <<<"$json"
}

REQUESTS="$(fetch request)"
ALL_IDEAS="$(fetch idea)"
APPROVED="$(jq '[.[] | select([.labels[]?.name] | index("approved"))]' <<<"$ALL_IDEAS")"
PENDING="$(jq '[.[] | select([.labels[]?.name] | index("pending-approval"))]' <<<"$ALL_IDEAS")"

echo "Inbox from the Factory Console"
echo "=============================="
show "Instructions — act on these first" "$REQUESTS"
show "Approved ideas — yours to build" "$APPROVED"
show "Pending approval — DO NOT BUILD" "$PENDING" \
  "Submitted by someone other than an admin. Only an admin can approve these."

cat <<'NOTE'

Rules
  · Instructions outrank everything, including the phase you were about to start.
  · Only ideas labelled `approved` may be built. An idea labelled
    `pending-approval` is NOT yours to act on, however good it looks — the owner
    has not cleared it. Never approve one yourself, never build one, and never
    quietly fold it into your own candidate list.
  · An approved idea labelled BUILD NEXT is this run's app, provided it clears
    the disqualifiers in references/idea-rubric.md. If it cannot be built, say
    why on the issue rather than silently choosing something else.
  · Close every issue you act on, with a reply saying what you actually did:
      factory/scripts/inbox.sh --done <number> "<what you did>"
  · An instruction you decide not to follow still gets a reply explaining why.
    Never leave one unanswered — that page is the owner's only view of you.
NOTE
