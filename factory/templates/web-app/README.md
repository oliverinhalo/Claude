# __APP_NAME__

__APP_DESCRIPTION__

**[Open the app →](https://__APP_SLUG__.pages.dev)**

No account. No tracking. Nothing leaves your browser.

---

## What it does

<!-- Replace: two or three sentences a stranger understands, and a screenshot. -->

## Why it exists

<!-- Replace: the specific problem, and what people do today instead. -->

## Running it locally

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build into `dist/` |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end and accessibility tests |
| `npm run typecheck` | Type checking |
| `npm run lint` | Lint |
| `npm run budget` | Bundle size budget |

## How it works

<!-- Replace: the interesting mechanism, if there is one. -->

Everything runs client-side. State is persisted to `localStorage` through a
versioned store that migrates old data and recovers from corrupt data rather
than failing — see `src/lib/storage.ts`.

## Roadmap

<!-- Replace: what a heavier user would want next. -->

## Licence

MIT — see [LICENSE](./LICENSE).

---

Built by the [weekly app factory](https://github.com/__OWNER__/Claude).
