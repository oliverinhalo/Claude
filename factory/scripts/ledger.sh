#!/usr/bin/env bash
# Record a shipped app. Run ONLY after the live URL has been verified.
#   ledger.sh add --slug s --name "N" --category c --repo o/r --url U --host h --score 7.5 \
#                 [--sentence "..."] [--signature "..."] [--paid-tier "..."] [--notes "..."]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LEDGER="$ROOT/factory/state/ledger.json"
SHIPPED="$ROOT/factory/state/shipped.md"
[ "${1:-}" = "add" ] || { echo "usage: ledger.sh add --slug ... " >&2; exit 2; }
shift

slug= name= category= repo= url= host= score= sentence= signature= paid= notes=
while [ $# -gt 0 ]; do
  case "$1" in
    --slug) slug="$2"; shift 2;;
    --name) name="$2"; shift 2;;
    --category) category="$2"; shift 2;;
    --repo) repo="$2"; shift 2;;
    --url) url="$2"; shift 2;;
    --host) host="$2"; shift 2;;
    --score) score="$2"; shift 2;;
    --sentence) sentence="$2"; shift 2;;
    --signature) signature="$2"; shift 2;;
    --paid-tier) paid="$2"; shift 2;;
    --notes) notes="$2"; shift 2;;
    *) echo "unknown flag: $1" >&2; exit 2;;
  esac
done

for v in slug name category repo url host score; do
  [ -n "${!v}" ] || { echo "missing --${v//_/-}" >&2; exit 2; }
done

if jq -e --arg s "$slug" '.apps[] | select(.slug == $s)' "$LEDGER" >/dev/null; then
  echo "refusing: '$slug' is already in the ledger" >&2; exit 1
fi

echo "verifying $url is live before recording…"
CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$url" || echo 000)"
[ "$CODE" = "200" ] || { echo "refusing: $url returned $CODE, not 200" >&2; exit 1; }

WEEK="$(( $(jq '.apps | length' "$LEDGER") + 1 ))"
jq --argjson w "$WEEK" --arg slug "$slug" --arg name "$name" --arg cat "$category" \
   --arg repo "$repo" --arg url "$url" --arg host "$host" --argjson score "$score" \
   --arg sent "$sentence" --arg sig "$signature" --arg paid "$paid" --arg notes "$notes" \
   --arg d "$(date -u +%Y-%m-%d)" \
  '.apps += [{week:$w, slug:$slug, name:$name, category:$cat, sentence:$sent,
              repo:$repo, url:$url, host:$host, shipped:$d, score:$score,
              signature_detail:$sig, paid_tier_hypothesis:$paid, notes:$notes}]' \
  "$LEDGER" > "$LEDGER.tmp" && mv "$LEDGER.tmp" "$LEDGER"

{
  echo "# Shipped apps"
  echo
  echo "| Week | App | What it does | Live | Repo | Score |"
  echo "|---|---|---|---|---|---|"
  jq -r '.apps[] | "| \(.week) | **\(.name)** | \(.sentence // .category) | [open](\(.url)) | [\(.repo)](https://github.com/\(.repo)) | \(.score)/10 |"' "$LEDGER"
  echo
  TOTAL=$(jq '.apps | length' "$LEDGER"); TGT=$(jq '.target' "$LEDGER")
  AVG=$(jq '[.apps[].score] | if length>0 then (add/length*10|round/10) else 0 end' "$LEDGER")
  echo "**$TOTAL of $TGT shipped · mean score $AVG/10**"
  echo
  echo "Updated by \`factory/scripts/ledger.sh\`. Do not edit by hand."
} > "$SHIPPED"

echo "ledger: week $WEEK — $name → $url"
