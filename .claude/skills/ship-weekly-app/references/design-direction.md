# Design direction

The goal is that someone cannot tell all 52 apps came from the same factory.
The starter gives structure. This phase gives identity. Decide it in writing
before building, because retrofitting a look onto a built app produces a
built app with a look on it.

## Decide these, write them into `docs/DESIGN.md` in the app

### 1. The one-word feeling

Pick one and let it decide the rest: *precise · calm · playful · dense ·
editorial · technical · warm · stark · retro · clinical*.

A budget tool that is `calm` and a budget tool that is `dense` are different
products. Choose before you open the CSS.

### 2. Type

- Two typefaces maximum, from a free source (Google Fonts, Fontshare).
  One is better than two badly paired.
- **Never ship the default system stack as the headline face.** That is the
  single clearest tell of an unconsidered app.
- A real scale: 12 / 14 / 16 / 20 / 25 / 31 / 39 (1.25) or 12 / 16 / 21 /
  28 / 37 / 50 (1.333). Pick one and use only its steps.
- Line height 1.5 for body, 1.1–1.2 for display. Measure 60–75 characters.
- Tabular numerals wherever numbers align. `font-variant-numeric: tabular-nums`.

### 3. Colour, as tokens

Define on `:root`, redefine under `@media (prefers-color-scheme: dark)` *and*
`[data-theme="dark"]`. Never use a raw hex in a component.

- One accent that carries meaning, not decoration. Blue-600 is a decision nobody made.
- A neutral ramp with at least 9 steps, slightly hue-shifted — pure grey reads cheap.
- Semantic tokens on top of the ramp: `--surface`, `--surface-raised`, `--border`,
  `--text`, `--text-muted`, `--accent`, `--accent-text`, `--danger`, `--success`.
- Check every text/background pair at 4.5:1 (3:1 for large text) in **both** themes.
  Dark mode is where contrast quietly fails.
- Dark mode is a designed palette. Desaturate the accent, lift the surface off pure
  black (`#0b0d10`, not `#000`), soften borders. Never `filter: invert()`.

### 4. Space and shape

- One spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Nothing between steps.
- One radius decision applied consistently — and consider 0. Sharp corners are a
  choice; 8px everywhere is the absence of one.
- Borders over shadows for structure; shadows only for things that genuinely float.
- Shadows need colour. A shadow is a tinted dark, never `rgba(0,0,0,.1)`.

### 5. Motion

- 120ms for state, 200ms for movement, 300ms for entrance. Nothing slower.
- `cubic-bezier(.2,0,0,1)` for entrances, `ease-out` for exits.
- Everything inside `@media (prefers-reduced-motion: reduce)` is off. Test it.
- Animate `transform` and `opacity`. Nothing else, ever.

### 6. The signature detail

One thing the app is remembered for. Not a gimmick — a detail that shows a person
was here. Some that have worked:

- Numbers that count up to their value when they change.
- A keyboard shortcut overlay that is genuinely beautiful.
- An empty state that is a tiny playable thing.
- Real-time preview in the favicon.
- A print stylesheet that produces something you would actually print.
- Sound, used exactly once, well.

Name it in the run report. An app with no answer to "what is the signature detail"
scores at most 5.

## Layout

- Content-first. Decide the one thing the eye lands on, make everything else quieter.
- Avoid the centred-card-on-grey-background layout. It is the uniform of the
  unconsidered app.
- 320px is a first-class target, not a degradation. Design it, do not let it happen.
- Touch targets 44×44 minimum. Hit areas larger than their visuals.
- Focus rings are visible, on-brand, and never removed. `:focus-visible`, always.
