#!/usr/bin/env bash
# Scaffold a new app from the production template.
#   new-app.sh <slug> "<App Name>" "<one-line description>"
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SLUG="${1:?slug required (lowercase-kebab-case)}"
NAME="${2:?app name required}"
DESC="${3:?one-line description required}"
DEST="$ROOT/apps/$SLUG"

[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "slug must be lowercase-kebab-case" >&2; exit 2; }
[ -e "$DEST" ] && { echo "$DEST already exists" >&2; exit 1; }
if jq -e --arg s "$SLUG" '.apps[] | select(.slug==$s)' "$ROOT/factory/state/ledger.json" >/dev/null; then
  echo "slug '$SLUG' is already shipped — pick another" >&2; exit 1
fi

mkdir -p "$ROOT/apps"
cp -r "$ROOT/factory/templates/web-app" "$DEST"

# Substitute template placeholders across every text file that contains one.
# An extension allowlist misses LICENSE, .env.example, .svg and .mjs — so match
# on content instead, and let grep -I skip binaries.
YEAR="$(date -u +%Y)"
OWNER="${FACTORY_OWNER:-oliverinhalo}"
mapfile -t TARGETS < <(grep -rlI '__APP_SLUG__\|__APP_NAME__\|__APP_DESCRIPTION__\|__YEAR__\|__OWNER__' "$DEST" || true)
for f in "${TARGETS[@]}"; do
  sed -i \
    -e "s|__APP_SLUG__|$SLUG|g" \
    -e "s|__APP_NAME__|$NAME|g" \
    -e "s|__APP_DESCRIPTION__|$DESC|g" \
    -e "s|__YEAR__|$YEAR|g" \
    -e "s|__OWNER__|$OWNER|g" \
    "$f"
done
echo "substituted placeholders in ${#TARGETS[@]} file(s)"

# Substituting a real app name changes line lengths, so the scaffold is only
# format-clean after a formatting pass. The gate checks formatting and must not
# be weakened, so do it here rather than leave a fresh scaffold failing.
if npx --yes prettier@3 --write "$DEST" >/dev/null 2>&1; then
  echo "formatted the scaffold"
else
  echo "warning: could not run prettier (offline?) — run 'npm run format' after npm install" >&2
fi

mkdir -p "$DEST/docs"
cat > "$DEST/docs/SPEC.md" <<SPEC
# $NAME — specification

> Written in Phase 3, before any app code. Replace every section.

## The sentence

$NAME helps **<specific person>** do **<specific job>** in **<specific time>**,
without **<what they do today>**.

## The core loop

1.

## Out of scope

-

## Acceptance criteria

1.

## Data model

## The four states

| State   | Behaviour |
| ------- | --------- |
| Empty   |           |
| Error   |           |
| Slow    |           |
| Offline |           |

## The one thing that must be excellent
SPEC

echo "scaffolded apps/$SLUG"
echo "next: cd apps/$SLUG && npm install"
