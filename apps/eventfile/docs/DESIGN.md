# Design decisions

## The one word

Stationery: warm, printed, dependable.

## Type

- Display face: system serif stack (Iowan Old Style / Palatino / Georgia). No font download.
- Body face: system sans. Mono for the file preview and dates.
- Scale: 1.25 modular scale from `--t-xs` to `--t-3xl`.

## Colour

Tokens live in `src/styles/tokens.css`. Both themes are checked at 4.5:1 by `tokens.test.ts` and axe.

- Surfaces: warm paper (light) and warm charcoal (dark), not a grey inversion.
- Accent: vermilion, the colour of a calendar's tear-off header; lightened in dark mode.

## Signature

The calendar leaf: the first occurrence rendered as a tear-off page beside the rule in words.

## States

Empty: never empty, a worked example is loaded. Error: field-specific messages and a disabled
download. Slow: nothing is asynchronous. Offline: fully client-side.
