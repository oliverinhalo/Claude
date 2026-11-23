# Eventfile

Write a recurring event once and download a correct `.ics` calendar file, with no account and no upload.

**[Open the app →](https://eventfile.pages.dev)**

No account. No tracking. Nothing leaves your browser.

---

## What it does

Fill in a title, a start, a time zone and how the event repeats (daily, weekly on chosen days,
monthly by date / nth weekday / last weekday, yearly; every N; never / N times / until a date).
Eventfile shows the next dates in plain English, then gives you a `.ics` file to download or copy.
Google Calendar, Apple Calendar and Outlook all import it.

## Why it exists

Club secretaries and team organisers need "every second Thursday at 19:00" in a calendar everyone can
subscribe to. Today that means hand-writing `RRULE` text, or using a generator that wants an account,
shows ads, or gets daylight-saving wrong.

## Running it locally

```bash
npm install
npm run dev
```

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Development server                 |
| `npm run build`     | Production build into `dist/`      |
| `npm test`          | Unit tests                         |
| `npm run test:e2e`  | End-to-end and accessibility tests |
| `npm run typecheck` | Type checking                      |
| `npm run lint`      | Lint                               |
| `npm run budget`    | Bundle size budget                 |

## How it works

- `src/lib/ics.ts` builds the RFC 5545 text: CRLF line endings, 75-octet folding that never splits a
  character, and escaping of `\ ; ,` and newlines.
- `src/lib/timezone.ts` derives a real `VTIMEZONE` from the browser's own `Intl` data: it finds the
  zone's offset changes in the event's year and writes them as yearly rules (e.g. "last Sunday of
  March"), so calendars keep the event at the same clock time through DST. It uses the zone's
  rules for the event's year; historic rule changes are not modelled.
- `src/lib/recur.ts` computes the preview dates and the plain-English rule. A weekly rule whose start
  weekday is not selected starts on the next selected weekday, so `DTSTART` always matches the rule.
- The form is stored in `localStorage` through a versioned store that recovers from corrupt data.

## Not included

Importing or editing existing files, attendees and invitations, exception dates, several events per
file, feeds. See `docs/SPEC.md`.

## Licence

MIT — see [LICENSE](./LICENSE).

---

Built by the [weekly app factory](https://github.com/oliverinhalo/Claude).
