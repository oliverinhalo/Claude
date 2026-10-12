# Cronlens — specification

## The sentence

**Cronlens** helps **a developer or ops engineer who schedules jobs in a local time zone** check **what a cron expression really does when the clocks change** in **under ten seconds**, without **doing wall-clock arithmetic by hand or finding out from a missed 02:30 backup**.

## The core loop

1. Open the page. A real, hazardous example (`30 2 * * *` in `America/New_York`) is already analysed.
2. Read the verdict sentence: how many upcoming clock changes break this schedule.
3. Edit the cron expression; the analysis updates live. Bad input gets a specific message, never a blank panel.
4. Change the time zone from a select.
5. Read the plain-English meaning of the expression.
6. Scan the next ten runs, each with local time, UTC offset and UTC time.
7. Read each upcoming clock change: the strip shows the missing or doubled hour with run marks; the text states the wall-clock fact for each affected run (does not exist / occurs twice), never what a scheduler does.
8. Copy a link (state lives in the URL hash).

## Out of scope

- Seconds fields, Quartz/Spring syntax (`?`, `L`, `W`, `#`), `@reboot`. Detected and explained, not parsed.
- Claiming how any one scheduler (Vixie cron, systemd, Kubernetes, EventBridge) resolves a skipped or repeated time. Cronlens reports the wall-clock facts; schedulers differ.
- Plain-text report export, theme toggle, settings of any kind.
- Multiple expressions at once, saved lists, accounts, notifications, monitoring.
- Windows other than the next 12 months; historical zone rules.
- Any server, network call, analytics, or font download from a third party.

## Acceptance criteria

1. On first load with no stored state, the h1, the example expression `30 2 * * *` and zone `America/New_York` are shown and at least one clock-change card reports a skipped run.
2. `*/15 * * * *` parses to 96 times per day; `0 9 * * 1-5` describes as exactly `At 09:00, Monday through Friday` (fixed string, asserted verbatim).
3. Day-of-month and day-of-week both restricted match when **either** matches (Vixie rule); either being a literal `*` means only the other applies (`*/2` counts as restricted; asserted with a test).
4. Names (`JAN`, `MON`), `7` as Sunday, lists, ranges and steps parse; `@daily`, `@hourly`, `@weekly`, `@monthly`, `@yearly` expand.
5. Invalid input (`61 * * * *`, `* * * *`, `* * * * * *`, `0 0 L * *`, `5-1 * * * *`, empty) shows an error naming the field and the legal range, linked by `aria-describedby` with `aria-invalid="true"` on the input.
6. For `America/New_York`, 2025-03-09 02:30 local is reported as not existing; 2025-11-02 01:30 as occurring twice, 3 600 s apart; `Asia/Kolkata` and `America/Phoenix` report no transitions in a year.
7. The next-runs list has ten rows in ascending instant order, and a time that does not exist locally never appears as a run and is listed in its clock-change card instead; a doubled time appears twice.
8. The URL hash `#c=<expr>&z=<zone>` restores state; an unknown zone falls back to the browser zone and shows a `role="status"` message containing the rejected zone name. The hash wins over stored state.
9. Corrupt stored state never prevents the page from rendering.
10. The whole core loop works with the keyboard alone; no axe serious/critical violations in light and dark; no horizontal scroll at 320 px.
11. After load, zero network requests occur (asserted in e2e by failing all requests); the core loop still works.
12. `analyse` takes `now` as a parameter; all date-dependent tests inject it. Criterion 1 is asserted with `now` fixed at 2025-01-01 and at 2025-06-01.
13. The verdict sentence states the integer count of clock changes in the next 12 months that skip or double at least one run, and says `none` when 0 (asserted for the NY example and `Asia/Kolkata`).
14. Each clock-change strip is a 24-hour track with hour ticks; the missing/doubled hour carries `data-kind="skipped|doubled"` and each run renders a mark (hazard marks `data-hit="true"`). The same facts are stated in text for screen readers.

## Data model

- Stored (`cronlens:state`, v1; written on every valid edit): `{ expr: string, zone: string }`. Absent or invalid → the example. Zone unknown to `Intl` → browser zone.
- Everything else is derived from `(expr, zone, now)` by pure functions: `parseCron`, `describe`, `nextRuns`, `findTransitions`, `analyse`.
- Time is handled as instants (ms since epoch) and "wall minutes" (ms of the local clock reading, as if UTC). Offsets come from `Intl.DateTimeFormat`, so zone rules are the browser's.

## The four states

| State   | Behaviour                                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty   | Never empty on first load: the example is analysed. If the user clears the field, a one-line hint with example chips replaces the results.                        |
| Error   | Inline message under the input, naming field and legal range; the previous valid results are removed (they would describe the wrong schedule).                    |
| Slow    | Analysis is synchronous and bounded (≤ 8 years of days, ≤ 2 000 minute checks per transition). A pathologically rare schedule shows "no run in the next 8 years". |
| Offline | Nothing calls the network; no service worker (out of scope). A footer note says analysis runs locally. Reloading with no connection is not promised.              |

## The one thing that must be excellent

The clock-change strip: a 24-hour bar for the day of the change that shows the hour that does not exist (or exists twice) and where your runs land in it, so the problem is seen before it is read.
