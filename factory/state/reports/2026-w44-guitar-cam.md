# Week 44 — Guitar Cam (resumed)

Owner brief: issue #4 — track the fretboard, tell me the note/chord playing, export files; learning mode nice-to-have.

## What happened
- Resumed a checkpoint stuck at `publish`. Main held two fixes (phantom chords, chord hold) not yet on staging.
- Gate failed first only because Playwright chromium was missing on the runner; installed it, no check changed. Gate 9/9.
- Published via push to `staging/guitar-cam`; live https://guitar-cam.pages.dev passes `verify-live.mjs` (200, title, h1, main, clean console, no 320px overflow).

## Contract notes
- Issue #4 must-haves are covered (fretboard, note/chord, exports as MusicXML/MIDI/ASCII tab/JSON; native .gp declined, explained on the issue). 
- The queue item's `mustHave` list is a pasted transcript of a Skool harmoniser ad, not requirements; it was not built as a harmoniser. Owner may want to review that brief.

## Not done
- QA agent and polish ladder/Lighthouse not re-run this run. Self-score 7/10.
