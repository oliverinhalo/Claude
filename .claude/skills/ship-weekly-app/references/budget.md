# Spending the whole budget

The instruction is to use the full weekly allowance. Two honest facts:

1. **No API reports remaining subscription usage.** Nothing can read the meter, so
   nothing can target 100% of it precisely.
2. **A session that hits the limit stops mid-sentence.** Unflushed work is lost.

So the strategy is not measurement. It is: *never idle, and never lose anything.*

## Never idle

The pipeline has no terminal state before the session dies. After Phase 9 closes
the run, the ladder in `polish-ladder.md` continues, and when it is exhausted the
agent starts the following week's app and checkpoints it. There is always a next
rung. An agent that reports "done, waiting for next week" has wasted the budget
it was told to spend.

Priority order when budget remains:

1. Finish this week's app to a 9.
2. Fix the lowest-scored shipped app in the ledger — a real improvement, redeployed.
3. Build next week's app ahead of schedule and leave it checkpointed.
4. Deepen the idea bank with 40 researched candidates, scored.

## Never lose anything

Checkpoint at every phase boundary, and commit far more often than feels necessary:

```bash
factory/scripts/checkpoint.sh <slug> <phase> in_progress
git add -A && git commit -m "<phase>: <what>" && git push
```

Work that is committed and pushed survives the session being cut off. Work in the
container does not — the container is reclaimed. **Push before every long phase,
not after it.**

The checkpoint file records enough that a cold session can resume with no context:

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

## The cadence

Two routines drive this:

| Routine | When | What it does |
|---|---|---|
| **Weekly app factory** | Mondays 07:43 | Starts the week's app, or resumes an unfinished one. Phases 1–9. |
| **Daily factory continuation** | Tue–Sun 07:17 | Never starts a new week's app from scratch. Resumes the checkpoint, climbs the polish ladder, raises the lowest-scored shipped app, or gets a head start on next week. |

The daily routine exists because a single weekly session does not consume a week's
allowance, and the instruction is to use it. It is also the recovery mechanism: a
Monday run that dies at phase 5 is finished by Tuesday rather than waiting seven
days.

A daily run that finds nothing to do is a bug in its own judgement, not a quiet
day. There is always a rung left on the ladder, always a five in the ledger worth
raising, and always next week's app to start.

## The rhythm of a run

Roughly, when the budget is generous:

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
working apps and 52 apps worth selling is entirely in that 35%.
