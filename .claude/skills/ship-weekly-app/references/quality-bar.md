# The quality bar

The gate is mechanical and binary. This is the judgement layer on top of it — the
rubric the run report scores the app against, out of 10.

## Non-negotiable floor (gate enforces; score 0 if any fails)

- Builds clean. No warnings waved through.
- Unit tests cover the data layer and every pure function.
- End-to-end smoke test drives the core loop in a real browser.
- Zero critical or serious axe violations.
- Keyboard-only path through the entire core loop.
- Works at 320px wide and at 2560px.
- Dark mode that was designed, not inverted.
- No console errors, no unhandled rejections, no layout shift on load.
- Main bundle under 150KB gzipped.
- Licence file, README, and a description that is not the slug.

## Scoring above the floor

| Score | What it means |
|---|---|
| 1–3 | It works. Nobody would choose it over the incumbent. |
| 4–5 | Competent. Looks like a good template. Forgettable. |
| 6–7 | Good. Someone would bookmark it. Has one detail that shows care. |
| 8 | Someone would send it to a colleague unprompted. |
| 9 | Someone would be annoyed if it went away. |
| 10 | Someone would pay, today, without being asked. |

Score honestly. The ledger's value is that a 5 is recorded as a 5 — that is what
makes it possible to come back and fix the fives later. A ledger of inflated
scores is worth nothing.

## The three tells of a template app, which is the failure mode to fear

1. **Default everything** — system font stack, a blue-600 primary, 8px radius
   everywhere, the shadow that ships with the framework.
2. **An empty state that says "No items yet"** — and nothing else.
3. **Copy written by a developer** — "Submit", "Oops! Something went wrong",
   "Item successfully created".

Any one of these caps the app at 5, regardless of how well it works.

## The tell of a real product

Someone made a decision that cost them something. A view that was cut. A default
that is opinionated. An interaction that took three attempts to get right. A piece
of copy that is funny once and never in the way. Find at least one per app and name
it in the run report.
