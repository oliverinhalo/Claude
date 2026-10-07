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

# Substitute template placeholders.
YEAR="$(date -u +%Y)"
while IFS= read -r -d '' f; do
  sed -i \
    -e "s|__APP_SLUG__|$SLUG|g" \
    -e "s|__APP_NAME__|$NAME|g" \
    -e "s|__APP_DESCRIPTION__|$DESC|g" \
    -e "s|__YEAR__|$YEAR|g" \
    -e "s|__OWNER__|${FACTORY_OWNER:-oliverinhalo}|g" \
    "$f"
done < <(find "$DEST" -type f \( -name '*.json' -o -name '*.ts' -o -name '*.tsx' -o -name '*.html' -o -name '*.md' -o -name '*.webmanifest' -o -name '*.txt' -o -name '*.yml' -o -name '*.css' \) -print0)

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

| State | Behaviour |
|---|---|
| Empty | |
| Error | |
| Slow | |
| Offline | |

## The one thing that must be excellent

SPEC

cd "$DEST"
git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1 && true
echo "scaffolded apps/$SLUG"
echo "next: cd apps/$SLUG && npm install"
