#!/usr/bin/env bash
# The gate. Every check must pass before an app is published.
# Never weaken a check to make it pass.
#   quality-gate.sh apps/<slug> [--skip-e2e]
set -uo pipefail

APP="${1:?usage: quality-gate.sh apps/<slug>}"
SKIP_E2E="${2:-}"
cd "$APP" || exit 2

PASS=0; FAIL=0
run() {
  local label="$1"; shift
  printf '\n\033[1m── %s\033[0m\n' "$label"
  if "$@"; then
    printf '\033[32m✓ %s\033[0m\n' "$label"; PASS=$((PASS+1))
  else
    printf '\033[31m✗ %s\033[0m\n' "$label"; FAIL=$((FAIL+1))
  fi
}

[ -d node_modules ] || npm ci --no-audit --no-fund || npm install --no-audit --no-fund

run "typecheck"      npm run --silent typecheck
run "lint"           npm run --silent lint
run "format"         npm run --silent format:check
run "unit tests"     npm run --silent test
run "production build" npm run --silent build
run "bundle budget"  npm run --silent budget

if [ "$SKIP_E2E" != "--skip-e2e" ]; then
  run "end-to-end + accessibility" npm run --silent test:e2e
fi

# Content checks the toolchain cannot catch.
printf '\n\033[1m── placeholder sweep\033[0m\n'
LEAKS="$(grep -rniE '\b(lorem ipsum|todo:|fixme|example\.com|your app name|__APP_|placeholder text)\b' \
          src public index.html README.md 2>/dev/null | grep -v node_modules || true)"
if [ -n "$LEAKS" ]; then
  printf '\033[31m✗ placeholder sweep\033[0m\n%s\n' "$LEAKS"; FAIL=$((FAIL+1))
else
  printf '\033[32m✓ placeholder sweep\033[0m\n'; PASS=$((PASS+1))
fi

printf '\n\033[1m── required files\033[0m\n'
MISSING=""
for f in README.md LICENSE docs/SPEC.md public/robots.txt; do
  [ -f "$f" ] || MISSING="$MISSING $f"
done
if [ -n "$MISSING" ]; then
  printf '\033[31m✗ missing:%s\033[0m\n' "$MISSING"; FAIL=$((FAIL+1))
else
  printf '\033[32m✓ required files\033[0m\n'; PASS=$((PASS+1))
fi

printf '\n═══════════════════════════════\n'
printf '  %d passed, %d failed\n' "$PASS" "$FAIL"
printf '═══════════════════════════════\n'
[ "$FAIL" -eq 0 ] || { echo "GATE FAILED — do not publish. Fix the cause, not the check." >&2; exit 1; }
echo "GATE PASSED"
