# Huekeep

Paste a colour pair that fails WCAG contrast and get the nearest passing colour **with the same hue**.

**[Open the app →](https://huekeep.pages.dev)**

No account. No tracking. Nothing leaves your browser. Works offline.

---

## What it does

You give it a text colour and a background. It tells you the WCAG 2.x contrast ratio and, if the pair misses your target (AA 4.5, AA-large/UI 3, or AAA 7), proposes two fixes: change the text, or change the background. Each shows the new hex, the new ratio, how far it moved, and a **lightness ribbon** — the colour at every lightness with the passing zones marked — so you can see why the fix sits where it does. Copy the hex or a CSS line, apply it, or share the pair as a link.

## Why it exists

Contrast checkers say "fail" and stop. The ones that suggest a fix usually nudge RGB or HSL lightness, which drifts the hue: brand orange turns brown, blue turns purple. Designers then fiddle with a picker until the number goes green.

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

Contrast is the WCAG 2.x ratio on 8-bit sRGB. The fix is found in OKLCH, where lightness is perceptual and hue is independent: Huekeep keeps hue and chroma, walks lightness outward from your colour in both directions, and takes the first step whose _rounded 8-bit_ result clears the ratio. Near black and white, single byte steps can rotate hue more than 2°, so those candidates are replaced by their best neighbouring byte value or rejected. Where a lightness cannot be as vivid inside sRGB, chroma is reduced; hue never is. Of the text fix and the background fix, the one with the smaller perceptual (OKLab) distance is listed first.

Not supported on purpose: transparency (contrast depends on what is behind), APCA, `oklch()`/`lab()` input.

State is persisted to `localStorage` through a versioned store that recovers from corrupt data rather than failing — see `src/lib/storage.ts`. Share links carry the pair in the URL hash.

## Roadmap

- Fix a whole palette at once against one background.
- APCA readout alongside WCAG 2.x.
- Export a set of passing tokens as CSS variables.

## Licence

MIT — see [LICENSE](./LICENSE).

---

Built by the [weekly app factory](https://github.com/oliverinhalo/Claude).
