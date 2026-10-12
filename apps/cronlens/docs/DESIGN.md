# Design decisions

## The one word

**Precise.** An instrument, not a dashboard: a lens you look through at a schedule.

## Type

- UI and display: **Instrument Sans** (variable, self-hosted via @fontsource, latin subset). Expressions and every time: **JetBrains Mono**. No third-party font request.
- Scale: 1.25 (12 / 14 / 16 / 20 / 25 / 31 / 39). Tabular numerals on all times.

## Colour

Tokens in `src/styles/tokens.css`. Warm paper neutrals; one accent, **amber** (`--accent`), because amber is the colour of the thing this app finds: the hour that goes missing. Hazard uses a separate red-ish `--danger`; safe uses green. Dark mode is a designed ink palette with a desaturated amber.

## Space, shape, motion

- Radius 2px / 4px. Sharp on purpose: it is a measuring tool.
- Borders for structure, no shadows except none.
- Motion: 120ms state changes only; strip marks fade in. All off under `prefers-reduced-motion`.

## The signature detail

The **clock-change strip**: a 24-hour bar per DST transition, hatched where the hour does not exist or doubled where it repeats, with your run times plotted as ticks that turn red when they land in the hazard.
