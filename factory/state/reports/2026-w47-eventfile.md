# Week 47 (second app) — Eventfile

Live: https://eventfile.pages.dev · Repo: oliverinhalo/eventfile. Queue and inbox were empty; own choice from the idea bank ("ICS builder", category `generator`, never shipped; recent categories music, accessibility, education, planner, calculator).

## Selection
Deviation from Phases 1–2: no fresh 40-candidate pass and no 8-way scoring table. Informal rubric score of the chosen idea ≈ 68/90 (ten-second value 5, one-run 5, repeat use 2, zero cost 5, findable 5, sellable 2, underserved 3, shareable 5, technical core 4). Above the 55 floor; no other candidate was scored.

## Built
Form → RFC 5545 .ics: daily/weekly(days)/monthly(date, nth, last weekday)/yearly, interval, never/count/until, all-day, reminder, location, notes. Real VTIMEZONE derived from Intl (yearly DST rules), plain-English rule, next-dates preview, download/copy, localStorage with corrupt-data recovery, tear-off calendar leaf, light/dark.

## Cut
Import/edit of existing files, attendees, exceptions, multi-event files, feeds, historic tz rules.

## QA
Foreground qa agent: 13/13 after fixes. Fixed: weekly interval anchored to the wrong week after DTSTART shift; NaN/fractional interval and count, and unreachable UNTIL, not flagged; clearing a number box poisoned saved state. Gate 9/9 re-run. My own earlier escaping bug (`\;`) was caught by lint and fixed.

## What broke
Playwright browser missing (installed). Nothing at publish.

## Known gaps
Fresh UID per change (re-import duplicates); start == end gives a 24h event; zones with >2 transitions a year (e.g. Cairo) get approximate rules; Lighthouse not measured; QA did not hand-verify full keyboard reachability.

## Score: 7/10
Correct, tested, accessible, verified live. Would do differently: run the real ideation pass and measure Lighthouse.

## Polish pass (2026-11-24, CONTINUE run)
Fixed two known gaps: UID is now stable per browser (re-import updates rather than duplicates); end time equal to start is a validation error instead of a silent 24h event. Tests added, gate 9/9, republished and verified live (200, clean console, no 320px overflow). Still open: Lighthouse not measured; Cairo-style multi-transition zones approximate; keyboard reachability not hand-verified by QA.
