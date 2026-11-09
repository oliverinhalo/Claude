# Crumb Clock — specification

## The sentence

**Crumb Clock** helps **a home sourdough baker** do **work out when to feed, mix, shape and bake** in **under ten seconds**, without **doing the back-of-envelope maths and setting eight alarms by hand**.

## The core loop

1. Open the page: a full schedule for a sensible evening is already shown.
2. Change the ready time.
3. Choose same-day or overnight (fridge) method.
4. Set kitchen temperature; durations rescale.
5. Read the timeline; night-time steps are flagged.
6. Export to calendar (.ics) or copy a link to the plan.

## Out of scope

- Recipes, hydration or flour calculators, baker's percentages.
- Accounts, sync, notifications beyond calendar alarms.
- Other breads, starter maintenance schedules, multiple loaves.
- Timers that run in the page.

## Acceptance criteria

1. On load with no input, 8 steps render and one h1 exists.
2. The last step ends exactly at the ready time; steps are contiguous.
3. Colder kitchens give longer total time than warmer ones.
4. Overnight includes a 12 h cold proof; same-day does not.
5. A plan needing a start in the past shows an alert with the earliest feasible time.
6. Steps starting 22:30–06:30 are flagged (except the fridge proof).
7. The .ics export has one VEVENT per step with UTC times and a 5-minute alarm.
8. A shared link restores method, temperature and time; malformed links are ignored.
9. Corrupt saved data shows a note and the app still works.
10. No axe violations in light and dark; no horizontal scroll at 320px.

## Data model

Stored locally: `{ method, roomTemp }` under `crumb-clock:state` (versioned envelope). The ready time is not stored; it is recomputed each visit because yesterday's time is useless. Absent or corrupt → defaults and (if corrupt) a visible note.

## The four states

| State   | Behaviour                                                       |
| ------- | --------------------------------------------------------------- |
| Empty   | Never empty: a seeded evening schedule renders immediately.     |
| Error   | Infeasible plan → alert with earliest time and a one-click fix. |
| Slow    | Everything is synchronous and local; nothing to wait for.       |
| Offline | Works offline after first load; no network calls at all.        |
