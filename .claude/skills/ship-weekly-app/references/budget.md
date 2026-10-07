# How hard to work

The standing instruction is to work hard and build to the best of your ability.
That is not the same as consuming a quota, and the difference matters:

- **Work hard** means the app is better when you stop than it was an hour ago.
- **Padding** means inventing work so the session looks busy — a seventh config
  option nobody asked for, a test that asserts the framework works, a refactor
  with no reader.

When the real work is done, stop and say so. A run that ships an excellent app in
half the time is a better run, not a wasted one. Never invent scope to fill a
session.

What "done" actually means is on the polish ladder, and it is a high bar: hostile
input survived, every string rewritten, Lighthouse ≥ 95 measured, real SEO, a
first run that is useful with zero input, the second feature built. Most runs will
not reach the top of that ladder. While a rung is genuinely unclimbed, you are not
done.

## Never lose anything

A session can end at any time — a limit, a timeout, a dropped container. Unflushed
work is lost, so checkpoint at every phase boundary and commit far more often than
feels necessary:

```bash
factory/scripts/checkpoint.sh <slug> <phase> in_progress "<next action>"
git add -A && git commit -m "<phase>: <what>" && git push
```

Work that is committed and pushed survives. Work in the container does not — the
container is reclaimed. **Push before every long phase, not after it.**

The checkpoint records enough that a cold session can resume with no context:

```json
{
  "slug": "…", "week": 7, "status": "in_progress",
  "last_completed_phase": "build",
  "next_action": "Run the quality gate; the date parser tests are the known gap.",
  "decisions": ["chose IndexedDB over localStorage: >5MB of attachments"],
  "blockers": [],
  "live_url": null
}
```

`next_action` is the important field. Write it as an instruction to a stranger,
because that is who reads it.

## When this week's app is genuinely finished

In priority order, and only if each is real work rather than padding:

1. Raise the lowest-scored app in the ledger. There will be one worth fixing.
2. Start next week's app — ideate, score, spec — and leave it checkpointed.
3. Deepen the idea bank with researched, scored candidates.
4. Nothing. Write the report, say the app is done, and end the run.

Option 4 is a legitimate outcome. Use it rather than manufacturing option 5.

## The cadence

Two routines drive this:

| Routine | When | What it does |
|---|---|---|
| **Weekly app factory** | Mondays 07:43 | Starts the week's app, or resumes an unfinished one. Phases 1–9. |
| **Daily factory continuation** | Tue–Sun 07:17 | Never starts a new week's app from scratch. Resumes the checkpoint, climbs the polish ladder, raises the lowest-scored shipped app, or gets a head start on next week. |

The daily routine is mainly a recovery mechanism: a Monday run that dies at phase 5
is finished on Tuesday rather than waiting seven days. Its second job is to raise
apps that shipped at a six.

A daily run that finds genuinely nothing worth doing should say so and end. That
will be rare — there is usually a rung left on the ladder or a five in the ledger
worth raising — but "nothing needed today" is an acceptable report, and far better
than busywork committed to a repo.

## The rhythm of a run

Roughly, when there is time for all of it:

| Phase | Share |
|---|---|
| Ideate + select | 5% |
| Plan + design | 10% |
| Build the core | 30% |
| Quality gate + QA | 10% |
| **Polish ladder** | **35%** |
| Publish + verify | 5% |
| Report + next week's head start | 5% |

The polish ladder is the largest slice on purpose. The difference between 52
working apps and 52 apps worth selling is entirely in that 35%. If a phase takes
less than its share because the work was genuinely simpler, that time goes to the
ladder — not to padding the phase.
