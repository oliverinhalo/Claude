# App Factory — repository conventions

This repository is a **control plane**, not an application. It runs one autonomous
pipeline per week that conceives, builds, and publishes a standalone production web
app into its *own* new GitHub repository.

## Layout

| Path | Purpose |
|---|---|
| `.claude/skills/ship-weekly-app/` | The pipeline the weekly agent executes. Start here. |
| `.claude/agents/` | Role sub-agents (PM, architect, designer, builder, QA, release, growth). |
| `factory/ideas/idea-bank.md` | Durable idea backlog. Append-only; never delete rejected ideas. |
| `factory/state/queue.json` | **The build order.** Position 1 is the next app. Owned by the console; never reordered by a run. |
| `factory/state/ledger.json` | Machine-readable record of every app shipped. Source of truth. |
| `factory/state/shipped.md` | Human-readable index of shipped apps. |
| `factory/state/run/` | Per-run checkpoints so an interrupted run can resume. |
| `factory/templates/web-app/` | The production starter every app is scaffolded from. |
| `apps/factory-console/` | The control-plane UI. Not one of the 52; never ledgered. |
| `services/console-auth/` | Cloudflare Worker: GitHub sign-in, admin allowlist, issue filing. |
| `factory/scripts/` | Deterministic helpers. Prefer these over ad-hoc commands. |
| `.github/workflows/publish-app.yml` | Privileged publisher: creates the app repo and deploys it. |

## Hard rules

1. **Never commit a secret.** Tokens live only in GitHub Actions secrets and the
   cloud environment. If you need one that is missing, record the gap in the run
   report and take the documented fallback path.
2. **Free tiers only.** No service that can bill. See `docs/ARCHITECTURE.md`.
3. **One app, one repo.** Apps are never merged into this repository's history
   beyond their `staging/<slug>` branch.
4. **The quality gate is not advisory.** `factory/scripts/quality-gate.sh` must
   exit 0 before anything is published. Do not weaken a gate to make it pass.
5. **Append to the ledger only after the app is live** and its URL returns 200.
6. **The queue decides what gets built.** If `factory/state/queue.json` is not
   empty, build position 1 — no ideation, no scoring, no substituting something
   that looks better. Remove it with `queue.sh --done <id>` once it is live. If
   it cannot be built, say why and leave it in place; never reorder or drop an
   item, and never skip to position 2.
7. **Never build a `pending-approval` idea, and never approve one.** Approval is
   the owner's, through the console. Building an unapproved idea is the one way
   this pipeline can do something nobody asked for.
8. **Sub-agents run in the foreground.** Always `run_in_background: false`. A
   factory run is headless — ending a turn to wait for a background agent kills
   the run, silently, mid-build. Never end a turn with work outstanding.
9. **Work is checkpointed.** Update `factory/state/run/<slug>.json` at every phase
   boundary; a run that is cut off mid-flight resumes from there.

## Conventions

- TypeScript strict. No `any` that a real type would serve.
- Every app ships with: unit tests, an end-to-end smoke test, an automated
  accessibility check, SEO metadata, a licence, and a README a stranger can follow.
- Commit messages: `<phase>: <what changed>` (e.g. `build: add recurrence parser`).
- Slugs are lowercase kebab-case, globally unique in the ledger.
