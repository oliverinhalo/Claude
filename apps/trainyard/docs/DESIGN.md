# Design decisions

## The one word

**Tactile** — a warm, paper-and-ink workbench where each thing you teach has its own coloured signal lamp.

## Type

- Display and body: the system UI sans, at weight 600–700 for headings. No web font: nothing to download before a 5 MB model.
- Mono (`ui-monospace`): wordmark and section eyebrows only — it marks "machine" things.
- Scale: the template's 1.25 ratio (`--t-xs` … `--t-3xl`).

## Colour

Tokens live in `src/styles/tokens.css`; both themes are contrast-checked by `tokens.test.ts` and axe.

- Accent: signal orange (`#a8420f` light, `#f08a4b` dark). It means "the primary action now": Start camera, Train, the selected class.
- Class lamps `--k-0…7`: eight hues, one per class, used only as fills, swatches and outlines — never as text colour.
- Dark mode: warm near-black (`#12100c`) with raised surfaces, not an inverted light theme.

## Space, shape, motion

- Radius 6 / 10 px. Hairline borders, with a soft tinted shadow only on panels.
- Motion: bars ease over 200 ms; a pulsing ring while recording; all of it disabled by `prefers-reduced-motion`.

## The signature detail

**Lamps.** A class's colour follows it everywhere: its card, its thumbnails, the ring around the camera while recording into it, and its confidence bar. Above the page runs a strip of rail sleepers — the "yard".
