# Architecture

## The goal

One autonomous run per week. Each run produces a finished, polished, publicly
usable web app, living in its own GitHub repository, deployed to a free host,
with a real URL. Fifty-two runs, fifty-two apps, no human in the loop per run.

## The constraint that shapes everything

Claude Code cloud sessions run behind a GitHub relay proxy that is **bound to the
repositories configured for the session**. This was verified directly, not assumed:

```
$ gh api -X POST user/repos -f name=...
403  This GitHub API path is not available: sessions are bound to their
     configured repositories. Use repository-scoped endpoints.

$ curl https://api.github.com/users/<anyone>
403  (same message — the proxy enforces this, not the token)

$ mcp__github__create_repository
403  Resource not accessible by integration
```

Repository-scoped paths (`/repos/{owner}/{repo}/...`) pass through normally,
**including `…/actions/workflows/{id}/dispatches`**.

So a cloud session cannot create the 52 repositories itself. One privileged step
has to run somewhere that is not behind the proxy. GitHub Actions runners are not.

## The second constraint, found the hard way

Scheduling was built on Claude Routines. It does not work, and the failure is
silent rather than loud:

```
A routine-fired session is created with sources: []
  → no git credential, no GitHub token
  → git push  →  403 "not in this session's authorized set"
  → gh api    →  rejected
```

A fired run read the pipeline, discovered it could not write, and stopped
having built nothing — while reporting itself complete. Every scheduled run
would have done the same.

So the schedule moved to `.github/workflows/run-factory.yml`, which runs the
pipeline through `anthropics/claude-code-action` on an Actions runner. The
runner has a real `GITHUB_TOKEN`, is not behind the session proxy, and
authenticates to Claude with a subscription OAuth token rather than metered
API billing. The routines are disabled.

This also collapses the architecture pleasantly: the privileged publisher was
already an Actions workflow, and now the thing that drives it is too.

## The split

```
  ┌─────────────────────────────── weekly Routine (cron) ──┐
  │                                                        │
  ▼                                                        │
┌──────────────────────────────────┐                       │
│  Cloud session (Claude Code)     │   thinking + building │
│                                  │                       │
│  1. ideate      40+ candidates   │                       │
│  2. select      scored rubric    │                       │
│  3. plan        spec + acceptance│                       │
│  4. design      visual direction │                       │
│  5. build       the actual app   │                       │
│  6. QA          gate must pass   │                       │
│  7. harden      polish ladder    │                       │
│                                  │                       │
│  pushes  staging/<slug>  ────────┼──► this repo          │
│  then dispatches ────────────────┼──┐                    │
└──────────────────────────────────┘  │                    │
                                      ▼                    │
                   ┌──────────────────────────────┐        │
                   │ .github/workflows/            │        │
                   │   publish-app.yml             │  privileged
                   │                               │        │
                   │ runs on a GitHub runner with  │        │
                   │ FACTORY_GH_TOKEN (a real PAT) │        │
                   │                               │        │
                   │ • create oliverinhalo/<slug>  │        │
                   │ • push app as repo root       │        │
                   │ • enable Pages / deploy CF    │        │
                   │ • set description, topics,    │        │
                   │   homepage URL                │        │
                   │ • commit ledger entry back    │        │
                   └───────────────┬───────────────┘        │
                                   ▼                        │
                        https://<app>.pages.dev  ───────────┘
                        (or oliverinhalo.github.io/<slug>)
```

The session polls the workflow run it dispatched (`actions_get`, `get_job_logs` —
both repo-scoped, both allowed) and treats a failed publish as its own problem to
fix, not a handoff.

## Hosting: free, and chosen in this order

| Rank | Host | Why | Requires |
|---|---|---|---|
| 1 | **Cloudflare Pages** | Unlimited static requests, unlimited bandwidth, 500 builds/mo, free `*.pages.dev`, Workers functions on the same free plan when an app needs a backend. | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` |
| 2 | **Vercel Hobby** | Good DX, fine for static + edge functions. Hobby forbids commercial use, so it is the *second* choice given the stated plan to sell later. | `VERCEL_TOKEN` |
| 3 | **GitHub Pages** | Needs **no secret at all** — `actions/configure-pages@v5` with `enablement: true` turns Pages on via the workflow's own `GITHUB_TOKEN`. | nothing |

GitHub Pages is the floor: the pipeline can publish a real, public, working URL
with zero credentials configured. Cloudflare is used the moment its token exists.
Nothing in the pipeline can reach a paid tier, because nothing in it has a payment
method attached.

## Data, where an app needs it

Static-first. In order of preference:

1. **No backend** — `localStorage` / IndexedDB / URL state. Most tools need nothing more.
2. **Cloudflare Workers + KV / D1** — free tier, same account, same deploy.
3. Nothing else. No Postgres with a trial clock, no service that asks for a card.

## Why one app per repository

Asked for, and also correct: each app gets its own issues, own stars, own CI, own
deploy, own licence, and can be sold, open-sourced, or transferred independently.
The factory repo stays a control plane and does not accumulate 52 apps' worth of
dependencies.

## The honest limits

- **One-time human setup is unavoidable.** A GitHub PAT must be created by a human
  once (GitHub does not let a token mint a token with broader scope). Cloudflare
  likewise requires a human to sign up once. After that, runs need nobody. The
  pipeline works with zero secrets via GitHub Pages in the meantime — it never
  blocks waiting for them. See `docs/SETUP.md`.
- **"Use 100% of the usage limit" is approximated, not measured.** No API exposes
  remaining subscription usage. The pipeline instead never idles: after the app
  passes its gate it climbs a polish ladder, and when the session is cut off
  mid-run the checkpoint lets the next wake resume exactly where it stopped.
  See `.claude/skills/ship-weekly-app/references/budget.md`.
- **"52 perfect apps" will not be 52 equal apps.** The gate guarantees a floor —
  it builds, it is tested, it is accessible, it is live, it is documented. Taste
  above that floor varies. The ledger records a self-assessed score per app so the
  weak ones are visible and can be revisited rather than silently averaged in.
