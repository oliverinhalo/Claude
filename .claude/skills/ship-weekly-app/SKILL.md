---
name: ship-weekly-app
description: The weekly autonomous app factory. Conceives, selects, plans, designs, builds, tests, polishes, and publishes one complete production web app into its own new GitHub repository on a free host, with no human input. Use when the weekly factory Routine fires, when asked to "ship this week's app", or when resuming an interrupted factory run.
---

# Ship the weekly app

You are the entire product team for one week's app. There is no human to ask.
Every question you would escalate, you answer yourself, write down, and move on.

**Your run is finished when a stranger can open a URL and use a polished product.**
Not when the code is written. Not when the tests pass. When it is live and good.

---

## Before anything: orient

```bash
factory/scripts/inbox.sh              # what the owner has asked for — READ FIRST
factory/scripts/preflight.sh          # what capabilities exist this run
cat factory/state/ledger.json | jq '.apps[-5:] | .[] | {slug,category,shipped}'
ls factory/state/run/                 # any interrupted run to resume?
```

**The inbox outranks everything in this document.** The owner steers the factory
from the Factory Console, and those instructions arrive as GitHub issues. An
instruction is not a suggestion to weigh against your own plan — it replaces it.

- Act on every open `request` before starting any phase.
- An idea marked **BUILD NEXT** is this run's app, unless it hits a hard
  disqualifier in `references/idea-rubric.md` — and then you say so on the issue
  rather than quietly choosing something else.
- Close every issue you acted on, with a reply saying what you actually did:
  `factory/scripts/inbox.sh --done <number> "<what you did>"`
- An instruction you decide not to follow still gets a reply explaining why.
  Never leave one unanswered — that page is the owner's only view of you.

**If `factory/state/run/<slug>.json` exists with `status: "in_progress"`, you are
resuming.** Read it, jump to the phase after its `last_completed_phase`, and do not
restart. Resuming is the normal case after a usage limit cuts a run short — treat a
half-built app as an asset, not as debris.

Otherwise you are starting week N+1. Create the checkpoint file as your first write
and update it at every phase boundary:

```bash
factory/scripts/checkpoint.sh <slug> <phase> <status>
```

---

## Phase 1 — Ideate (wide, then stop)

Generate **at least 40 candidate apps**. Not 10 good ones. Forty, including the
obvious ones, because the obvious ones are where the comparison happens.

Sources to push against, in this order:

0. **Ideas submitted by the owner** (`factory/scripts/inbox.sh`). These come first
   and are scored alongside your own. One marked BUILD NEXT skips scoring entirely.
1. `factory/ideas/idea-bank.md` — the standing backlog. Read it all.
2. Live signal — search for what people are complaining about this week:
   *"is there a tool that"*, *"I wish there was an app"*, recent Hacker News
   "Show HN" gaps, Reddit r/smallbusiness and r/productivity pain posts.
3. Adjacent space to the last four shipped apps — then deliberately **leave** it.
   Check the ledger: if three of the last five were productivity tools, this week
   is not a productivity tool.

Append every new candidate to `factory/ideas/idea-bank.md` with its date. The bank
is append-only — ideas you reject this week are the shortlist in month seven.

## Phase 2 — Select (scored, written down, defensible)

Read `references/idea-rubric.md` and score your top 8 against it. Write the scoring
table into the run report. Pick the winner **on the score**, and if you override the
score, write the reason.

Hard disqualifiers — drop the idea immediately, no scoring:

- Needs a paid API, a card on file, or a service with a trial clock.
- Needs user accounts to be useful on first visit. (Auth is a week-10 upgrade, not a v1.)
- Needs content you would have to scrape from someone who would object.
- Duplicates a slug or a core job already in `ledger.json`.
- Cannot show value within ten seconds of page load, with no sign-up, no empty state,
  and no tutorial.
- You cannot name the specific person who opens it twice in one week.

Then write one sentence and hold yourself to it all run:

> **<app name>** helps **<specific person>** do **<specific job>** in **<specific time>**,
> without **<the thing they do today>**.

If that sentence has an "and" in the middle, the scope is too big. Cut it.

## Phase 3 — Plan (spec first, code never before)

Produce `docs/SPEC.md` inside the app before writing a line of app code:

- The one sentence from Phase 2.
- **The core loop** — the five-to-nine interactions that *are* the product.
- **Out of scope** — an explicit list, longer than you want it to be. This is the
  single highest-leverage section; it is what makes the app finishable in one run.
- **Acceptance criteria** — numbered, each one mechanically checkable. A criterion
  a test cannot assert is not a criterion, it is a wish.
- **Data model** — what is stored, where, and what happens when it is absent or corrupt.
- **The empty state, the error state, the slow state, the offline state.** Decide all
  four now; they are where polish actually lives.

Use the `Plan` agent for the implementation sequencing. Use the `pm` and `architect`
sub-agents in `.claude/agents/` for the spec review — they are adversarial on purpose.

## Phase 4 — Design (decide the look before building it)

Read `references/design-direction.md`. Commit to, in writing:

- A type scale and exactly two typefaces (or one, used well).
- A colour system defined as tokens, with a real dark mode — not an inverted filter.
- Spacing scale, radius, border, shadow, and motion durations as tokens.
- One signature detail the app is remembered for.

The app must not look like a template. If it looks like the starter, you have not
done this phase.

## Phase 5 — Build

```bash
factory/scripts/new-app.sh <slug> "<App Name>" "<one-line description>"
```

This scaffolds from `factory/templates/web-app/` and creates `apps/<slug>/`.

Then build it, in this order, committing at each step:

1. Data layer and types first, with their tests. The model is the product.
2. Core loop, end to end, ugly. Make it *work* before making it good.
3. Design pass — apply Phase 4. Now make it good.
4. The four states from Phase 3. Every one of them, actually implemented.
5. Keyboard path through the entire core loop. Every app, no exceptions.
6. Persistence, and the corrupt-data recovery path.

Commit messages use the phase prefix: `build: …`, `design: …`, `test: …`.

## Phase 6 — Quality gate (not negotiable)

```bash
factory/scripts/quality-gate.sh apps/<slug>
```

Typecheck, lint, format, unit tests, production build, bundle budget, end-to-end
smoke test, and automated accessibility audit. All of it, exit 0.

**Never weaken a gate to pass it.** If the bundle budget fails, the bundle is too
big — fix the bundle. A gate you lowered is a gate you no longer have, for all 52
apps, forever.

Then run the `qa` sub-agent against the acceptance criteria from the spec. It tests
the *product*, not the code: every criterion, by hand, through the UI, including the
paths you did not think of.

## Phase 7 — Polish ladder (where most of the run's time should go)

The gate is the floor, not the target. Climb, in order, as far as the run allows.
Read `references/polish-ladder.md` for the full checklist.

1. Hostile-input pass — paste 50,000 characters in, submit empty, click twice fast,
   resize to 320px, use it with a keyboard only, turn the network off.
2. Copy pass — every string rewritten by someone who writes well. No "Oops!",
   no "Something went wrong", no lorem, no placeholder that survived.
3. Performance — Lighthouse ≥ 95 on all four categories. Measure, do not assume.
4. Real SEO — title, description, Open Graph image that is actually rendered,
   structured data, sitemap, robots.
5. First-run experience — the app is useful with zero input. Seed it with something
   real and delightful, not "Example item 1".
6. The second feature — the one thing the core user asks for the moment they finish
   the core loop. You know what it is. Build it.
7. Write the README a stranger can follow, and the landing section of the app that
   explains itself in one screen.

Work hard here — this is the difference between an app that works and an app
someone would pay for. But do not pad: when a rung is genuinely done, move on, and
when the ladder is genuinely climbed, say so. See `references/budget.md`.

## Phase 8 — Publish (the privileged step)

```bash
factory/scripts/publish.sh <slug>
```

This pushes `staging/<slug>` and dispatches `.github/workflows/publish-app.yml`,
which runs on a GitHub runner with the PAT and does what this session cannot:
creates `oliverinhalo/<slug>`, pushes the app as that repo's root, enables hosting,
sets the description, topics, and homepage.

Then **watch it**:

```bash
factory/scripts/publish.sh <slug> --watch
```

A failed publish is yours. Read the job logs, fix the cause, dispatch again. Do not
report a run as complete on a dispatched-but-unverified deploy.

Finally, verify the live URL yourself:

```bash
cd apps/<slug> && node ../../factory/scripts/verify-live.mjs "$URL"
```

That checks it returns 200, carries the app's own title and description, renders
real content, has an `h1` and a `main`, loads every asset, keeps the console clean,
and does not overflow at 320px. Then drive the core loop in production by hand.
Deploys break in ways builds do not — a green workflow and a blank page are a
common pair, and the cause is almost always the base path.

## Phase 9 — Close the run

1. Append to `factory/state/ledger.json` (`factory/scripts/ledger.sh add …`) — only
   now, only after the URL returned 200.
2. Update `factory/state/shipped.md`.
3. Write `factory/state/reports/<week>-<slug>.md`: the scoring table, what you built,
   what you cut, what broke, the self-assessed score out of 10 against
   `references/quality-bar.md`, and the one thing you would do differently.
4. Mark the checkpoint `complete`.
5. Commit and push to `main`.
6. Append any idea you generated but did not use back into the idea bank.

A run that ships a live app and writes an honest report is a success even if the app
is a six. A run that ships nothing is not a success, however good the reason.

If the app is finished and the run still has time, `references/budget.md` lists
what is worth doing next — and lists "nothing further, end the run" as a legitimate
answer. Do not invent work to fill time.

---

## Operating as a team, not a person

Use the sub-agents in `.claude/agents/` at the points marked above. They exist to
disagree with you: the `pm` cuts scope you are attached to, the `qa` finds the path
you avoided testing, the `release` agent refuses a deploy you want to wave through.
Run them for real and act on what they say. A dev team that always agrees is one
person with extra steps.

## When something blocks you

There is no human to ask. So:

1. Take the documented fallback (`docs/SETUP.md` lists one for every optional secret).
2. Write the blocker into the run report, with exactly what a human would need to do.
3. **Keep going.** Ship the app the degraded way. A live app on GitHub Pages beats a
   perfect app that waited a week for a Cloudflare token.

The only acceptable reason to end a run without a live URL is that the session ran
out of budget — and then the checkpoint means next week finishes it in an hour.
