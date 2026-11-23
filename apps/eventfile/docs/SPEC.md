# Eventfile — specification

## The sentence

**Eventfile** helps **a club secretary or team organiser** write **one recurring event** and get
**a correct .ics file** in **under a minute**, without **hand-editing RRULE text, trusting an
ad-laden generator, or signing up for anything**.

## The core loop

1. Open the page: a worked example event (a fortnightly Thursday meeting) is already filled in, with its next occurrences and its raw .ics visible.
2. Edit title, date, start and end time, time zone.
3. Pick a repeat: none, daily, weekly (weekdays), monthly (day / nth weekday / last weekday), yearly; interval; end never / after N / on a date.
4. Watch the "next occurrences" list update live, in plain English.
5. Optionally add a reminder, location, description.
6. Download `.ics`, or copy the text.
7. Form is remembered locally and restored next visit.

## Out of scope

- Importing or editing existing .ics files; multiple events per file; attendees / invitations (ORGANIZER, ATTENDEE).
- Exception dates, per-instance overrides, RDATE, BYSETPOS beyond "last weekday".
- Subscribing to feeds, accounts, sync, sharing links.
- Historic time-zone rule changes (the zone's rules for the event's year are used).
- Sub-minute precision, multiple alarms, attachments, conferencing links beyond the plain URL in the description.

## Acceptance criteria

1. On first load, with no input, the page shows an example event, a non-empty occurrences list and a `BEGIN:VCALENDAR` preview.
2. Output uses CRLF line endings, no line longer than 75 octets, and escapes `\ ; , newline` in text.
3. A weekly event on Mon+Wed with interval 2 produces `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE`.
4. A monthly "nth weekday" event on the second Tuesday produces `BYDAY=2TU`; "last weekday" produces `BYDAY=-1<WD>`.
5. A timed event in an IANA zone with DST emits a `VTIMEZONE` with matching `TZID`, and DAYLIGHT/STANDARD rules with yearly `RRULE`s (e.g. Europe/London → last Sunday March/October).
6. A zone without DST emits a single STANDARD component; "Floating" emits no `TZID` and no `VTIMEZONE`.
7. An all-day event uses `VALUE=DATE`, and `DTEND` is the day after the last day (exclusive).
8. End "after N" produces `COUNT=N`; end "on date" produces `UNTIL` (UTC for timed zone events, DATE for all-day).
9. A weekly event whose start weekday is not selected starts on the first selected weekday after it, and `DTSTART` says so.
10. An empty title, an end date before the start, an invalid date, or a count < 1 shows an inline error naming the field, disables Download, and never emits a file.
11. Download produces a file named from the title (`my-event.ics`) with MIME `text/calendar`.
12. Corrupt or foreign stored data is discarded and the example is shown, with a notice.
13. Everything is reachable by keyboard; no axe serious/critical violations in light and dark; no horizontal scroll at 320px.

## Data model

One localStorage key `eventfile:state`, versioned envelope via `createStore`: the form object
(`EventForm`). Validator is strict (every field typed and range-checked). Absent → example.
Corrupt → example plus a "recovered" notice. No server, no network.

## The four states

| State   | Behaviour                                                                     |
| ------- | ----------------------------------------------------------------------------- |
| Empty   | Never empty: the example event is prefilled. "Start from blank" clears it.    |
| Error   | Inline, field-specific messages; download disabled with the reason beside it. |
| Slow    | Everything is synchronous. VTIMEZONE derivation is memoised per zone/year.    |
| Offline | Fully client-side; works with the network off. Stated in the footer.          |

## The one thing that must be excellent

Correctness of the file: a calendar app (Google, Apple, Outlook) must put the event on the
same wall-clock time across DST changes, which needs a real VTIMEZONE.
