# Deploy runbook

## What the session can and cannot do

| Action | From the cloud session | Why |
|---|---|---|
| Push a branch to this repo | ✅ | git proxy allows the configured repo |
| Read/write files in this repo via API | ✅ | repo-scoped path |
| Dispatch a workflow in this repo | ✅ | `repos/{o}/{r}/actions/...` is repo-scoped |
| Read workflow runs and job logs | ✅ | repo-scoped |
| **Create a new repository** | ❌ | `403` — proxy binds the session to configured repos |
| Push to a repo not in the session | ❌ | same |

Everything in the ❌ column happens inside `.github/workflows/publish-app.yml`,
on a GitHub runner, which is not behind the proxy.

## The publish sequence

```bash
factory/scripts/publish.sh <slug>            # push + dispatch
factory/scripts/publish.sh <slug> --watch    # poll to completion, print logs on failure
```

What the workflow does, in order:

1. Checks out `staging/<slug>` and verifies `apps/<slug>` exists and builds.
2. Creates `oliverinhalo/<slug>` (public) with `FACTORY_GH_TOKEN`.
   - Already exists → reuses it. The pipeline is idempotent; a retry is safe.
   - No PAT → **fallback**: publishes under this repo at `apps/<slug>` and says so.
3. Pushes `apps/<slug>/` as the new repo's root, with the app's own CI workflow.
4. Picks a host:
   - `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` → Cloudflare Pages, `<slug>.pages.dev`
   - else `VERCEL_TOKEN` → Vercel
   - else → GitHub Pages via `actions/configure-pages@v5` with `enablement: true`,
     which turns Pages on using the workflow's own token. No secret needed.
5. Sets the new repo's description, topics, and homepage to the live URL.
6. Waits for the URL to return 200, then writes the result back to this repo.

## Verify it yourself — the workflow passing is not proof

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$URL"
curl -sS "$URL" | grep -o '<title>[^<]*</title>'

# Playwright: renders, no console errors, no failed assets, no 320px overflow.
# Run from inside the app so Playwright resolves from its node_modules.
cd apps/<slug> && node ../../factory/scripts/verify-live.mjs "$URL"
```

A green workflow with a white-screen deploy is the most common failure in this
pipeline. The base path is almost always the cause: GitHub Pages serves at
`/<repo>/`, Cloudflare at `/`. The template reads `VITE_BASE`; the workflow sets it
per host. If assets 404, that is what went wrong.

## Common failures

| Symptom | Cause | Fix |
|---|---|---|
| Blank page, assets 404 | wrong `VITE_BASE` | workflow sets it per host; check it was passed to the build |
| `403` creating the repo | PAT missing *Administration: write* at the account level | `docs/SETUP.md` step 1.6 |
| Pages 404 for ~60s after deploy | first-ever Pages build | wait and re-poll; not an error |
| Cloudflare `Authentication error` | token scoped to the wrong account | recreate with *Edit Cloudflare Workers*, select the account |
| Router 404 on refresh | SPA fallback missing | template's postbuild copies `index.html` → `404.html`; confirm it ran |
