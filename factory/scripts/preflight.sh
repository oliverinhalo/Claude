#!/usr/bin/env bash
# Report which factory capabilities are available this run, and the fallback for
# each missing one. Never fails: a missing optional secret is a degraded mode.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ok()   { printf '  \033[32m●\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m●\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m●\033[0m %s\n' "$1"; }

echo
echo "App factory preflight"
echo "====================="
echo
echo "Toolchain"
for t in node npm git jq gh; do
  if command -v "$t" >/dev/null 2>&1; then
    ok "$t $(${t} --version 2>/dev/null | head -1 | tr -d '\n')"
  else
    bad "$t missing"
  fi
done

echo
echo "GitHub"
if gh api "repos/${GITHUB_REPOSITORY:-oliverinhalo/Claude}" -q .full_name >/dev/null 2>&1; then
  ok "repo-scoped API reachable"
else
  bad "repo-scoped API unreachable — publishing will fail"
fi
if gh api user/repos -q '.[0].name' >/dev/null 2>&1; then
  ok "account-scoped API reachable (unusual — direct repo creation possible)"
else
  warn "account-scoped API blocked (expected) — repo creation goes via publish-app.yml"
fi

echo
echo "Secrets configured in this repository (names only; values never printed)"
SECRETS="$(gh api "repos/${GITHUB_REPOSITORY:-oliverinhalo/Claude}/actions/secrets" -q '.secrets[].name' 2>/dev/null)"
have() { grep -qx "$1" <<<"$SECRETS"; }

if have FACTORY_GH_TOKEN; then
  ok "FACTORY_GH_TOKEN — each app gets its own repository"
else
  warn "FACTORY_GH_TOKEN missing → fallback: apps publish as subdirectories of this repo"
  echo "      fix: docs/SETUP.md step 1"
fi

if have CLOUDFLARE_API_TOKEN && have CLOUDFLARE_ACCOUNT_ID; then
  ok "Cloudflare — hosting on *.pages.dev"
elif have VERCEL_TOKEN; then
  warn "Cloudflare missing, Vercel present → hosting on Vercel (Hobby forbids commercial use)"
else
  warn "No host token → fallback: GitHub Pages (works with zero secrets)"
  echo "      fix: docs/SETUP.md step 2"
fi

echo
echo "Factory state"
LEDGER="$ROOT/factory/state/ledger.json"
if [ -f "$LEDGER" ]; then
  COUNT="$(jq '.apps | length' "$LEDGER")"
  TARGET="$(jq '.target' "$LEDGER")"
  ok "$COUNT of $TARGET apps shipped"
  if [ "$COUNT" -gt 0 ]; then
    echo "      recent categories: $(jq -r '[.apps[-5:][].category] | join(", ")' "$LEDGER")"
  fi
else
  bad "ledger.json missing"
fi

INPROGRESS="$(grep -l '"status": *"in_progress"' "$ROOT"/factory/state/run/*.json 2>/dev/null || true)"
if [ -n "$INPROGRESS" ]; then
  warn "interrupted run(s) found — RESUME these before starting anything new:"
  for f in $INPROGRESS; do
    echo "      $(basename "$f"): $(jq -r '.last_completed_phase + " → " + .next_action' "$f" 2>/dev/null)"
  done
else
  ok "no interrupted runs"
fi
echo
