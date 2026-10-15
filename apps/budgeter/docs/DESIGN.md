# Design decisions

## The one word

Editorial — a payslip that has been typeset by someone who cares.

## Type

- Display face: Iowan Old Style / Palatino / Georgia serif stack for figures and headings.
- Body face: system sans.
- Scale: 1.25 (12 / 14 / 16 / 20 / 25 / 31 / 39). Tabular numerals for all money.

## Colour

Warm paper surfaces, ink-blue accent. Both themes checked at 4.5:1 by `tokens.test.ts`.

- Accent means "this is your money". Spending uses the warm clay `--spend`; deductions are neutral greys.
- Dark mode: lifted blue-black surfaces, desaturated accent.

## Space, shape, motion

- Radius 2px: payslip-sharp.
- Borders and rules, not shadows.
- Motion: 120ms state changes only; bar segments animate width at 200ms, off under reduced motion.

## The signature detail

The pay strip: one ruled bar showing a year of gross pay divided into tax, NI, loan, pension, spending and what is left, labelled like the columns of a payslip.
