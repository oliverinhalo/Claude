# Crumb Clock

Tell it when you want bread on the table and it works backwards to when to feed, mix, fold, shape and bake your sourdough.

**[Open the app →](https://crumb-clock.pages.dev)**

No account. No tracking. Nothing leaves your browser.

---

## What it does

Pick the time you want to slice a loaf, the method (same day or overnight in the fridge) and your kitchen temperature. You get a timeline of every step with its start time, night-time steps flagged, a one-click calendar export (.ics with alarms) and a link you can share.

## Why it exists

Sourdough schedules are always written forwards ("feed at 8am"), but bakers think backwards ("dinner at 7"). Most people do the arithmetic by hand and set a pile of alarms.

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

Durations are scaled by a temperature factor (fermentation roughly halves per 8 °C of warmth, baseline 24 °C) and laid out backwards from the ready time in `src/lib/schedule.ts`. Plans are shared through the URL hash, so there is no server.

Everything runs client-side. State is persisted to `localStorage` through a
versioned store that migrates old data and recovers from corrupt data rather
than failing — see `src/lib/storage.ts`.

## Roadmap

- Hydration and flour calculator
- Multiple loaves and other doughs
- Starter maintenance reminders

## Licence

MIT — see [LICENSE](./LICENSE).

---

Built by the [weekly app factory](https://github.com/oliverinhalo/Claude).
