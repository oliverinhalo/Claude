# The weekly app factory

One run a week. Each run conceives, plans, designs, builds, tests, polishes and
**publishes a finished web app into its own GitHub repository on a free host** —
with nobody in the loop.

Fifty-two runs. Fifty-two live products.

```
Monday 07:43 ──► idea bank + live signal ──► 40 candidates
                                              │
                               scored against a 9-point rubric
                                              │
                                        one winner
                                              │
      spec ──► design direction ──► build ──► quality gate ──► polish ladder
                                                                     │
                                            own repo + live URL ◄─────┘
                                                                     │
                                      ledger, run report, next week's head start
```

## Start here

| If you want to… | Read |
|---|---|
| Turn it on (≈10 minutes, once) | [`docs/SETUP.md`](docs/SETUP.md) |
| Understand how it works and why | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Read what the agent actually does | [`.claude/skills/ship-weekly-app/SKILL.md`](.claude/skills/ship-weekly-app/SKILL.md) |
| See what has shipped | [`factory/state/shipped.md`](factory/state/shipped.md) |

## How it is put together

**The pipeline** — nine phases, in `.claude/skills/ship-weekly-app/SKILL.md`.
Ideate wide, select on a written score, spec before code, decide the look before
building it, build, gate, polish, publish, report.

**The team** — six adversarial role agents in `.claude/agents/`. The PM cuts scope
the builder is attached to. QA has a veto. The release engineer refuses to record
a run as shipped on a URL nobody fetched. They exist to disagree.

**The gate** — `factory/scripts/quality-gate.sh`. Typecheck, lint, format, unit
tests, production build, bundle budget (150kB gzipped), end-to-end smoke test,
automated accessibility audit, placeholder sweep, required files. Exit 0 or
nothing publishes. *Weakening a gate to pass it is forbidden* — it would lower
the floor for all 52 apps at once.

**The starter** — `factory/templates/web-app/`. React 19, strict TypeScript,
Tailwind v4, a design-token layer with a real dark mode, versioned local storage
that migrates old data and recovers from corrupt data, Vitest, Playwright, axe.

**The publisher** — `.github/workflows/publish-app.yml`. Creates the app's own
repository, pushes it, deploys it, verifies the URL returns 200, writes the result
back.

**The safety net** — `.github/workflows/factory-health.yml` opens an issue if a
week passes with nothing shipped, so a silent stall cannot last a month.

## The constraint worth knowing about

Claude Code cloud sessions are bound by a relay proxy to the repositories they
were configured with. Creating a new repository returns `403` from inside one —
from the API, from `gh`, and from raw `curl` alike, because the proxy enforces it
rather than the token.

So the factory is split. The session does the thinking and the building. One
GitHub Actions workflow, running on a runner that is not behind that proxy, does
the single privileged step. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) has the
evidence and the diagram.

## Hosting, and what it costs

Nothing, and it cannot start costing, because nothing in the pipeline has a payment
method attached.

| | | Needs |
|---|---|---|
| **Cloudflare Pages** | preferred — unlimited requests and bandwidth, Workers and D1 on the same free plan | a free token |
| Vercel Hobby | second — its licence forbids commercial use, which matters if you sell these | a free token |
| **GitHub Pages** | the floor — works with **zero secrets configured** | nothing |

With nothing set up at all, the factory still ships a real, public, working URL
every week. Each secret you add removes a limitation; none of them block a run.

## Honest limits

- **One human action is unavoidable.** GitHub will not let a token mint a token
  with broader scope, so a person must create the PAT once. Ten minutes, once a
  year. Until then apps publish as subdirectories, and every run says so loudly.
- **"Use the whole usage limit" is approximated.** Nothing can read remaining
  subscription usage, so the pipeline instead never idles — after the gate passes
  it climbs a polish ladder, and when it runs out of ladder it starts next week's
  app. Work is checkpointed at every phase so being cut off mid-run loses nothing.
- **52 apps will not be 52 equal apps.** The gate guarantees a floor: it builds, it
  is tested, it is accessible, it is live, it is documented. Taste above that floor
  varies. Each run self-scores out of 10 in the ledger, honestly, so the weak ones
  stay visible and can be returned to — which is the point of recording a 5 as a 5.

## Selling them later

Deliberately not built yet, and deliberately prepared for. No paywall, no email
capture, no cookie banner, no third-party scripts — those cost more trust than
they return while an app has no users. What each app ships with instead: a natural
paid boundary at the edge of its feature set (noted in its README roadmap), a
genuine privacy story, and something worth sharing. `.claude/agents/growth.md`
has the reasoning.
