# Design decisions

## The one word

**Precise.** An instrument, not a form. Hairline borders, tabular numerals, one confident accent.

## Type

- One family: **Bricolage Grotesque** (variable, self-hosted via @fontsource-variable), used for display and body. Hex values and ratios use the system monospace.
- Scale: 1.25 — 12 / 14 / 16 / 20 / 25 / 31 / 39. Body line height 1.5, display 1.1.

## Colour

Tokens live in `src/styles/tokens.css`. Both themes were checked at 4.5:1, and a unit test runs the app's own palette through the app's own contrast code.

- Accent: ultramarine violet — the one colour that means "interactive / the fix".
- Neutrals are warm-shifted paper and ink. Dark mode is a designed palette on `#0c0c10`, accent lifted and softened.

## Space, shape, motion

- Radius: 2px on controls, 0 on the ribbon. Sharp corners are the choice.
- Borders over shadows; there are no shadows except focus.
- Motion: 120ms state changes; markers glide 200ms; all off under reduced motion.

## The signature detail

The lightness ribbon (see SPEC) — and the favicon-free but title-visible live ratio.
