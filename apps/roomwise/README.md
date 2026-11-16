# Roomwise

Split the rent by room size and perks, so housemates agree on a fair number in a minute.

**[Open the app →](https://roomwise-i1p.pages.dev)**

No account. No tracking. Nothing leaves your browser.

---

## What it does

Enter the total rent, then each room's size and perks (ensuite, balcony, dark window…). Roomwise gives every room a fair share that adds up to the rent exactly, shows the arithmetic under each room, and lets you copy a share link or a plain-text summary for the house chat.

## Why it exists

Splitting rent equally is unfair when one room is twice the size of another. Splitting it fairly usually means a spreadsheet and an argument. Roomwise makes the method visible and the weights adjustable.

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

weight = (room area + equal slice of shared space) × (1 + sum of perk percentages). Shares use largest-remainder rounding so they always sum to the rent. The whole state is mirrored into the URL hash, which is what makes links shareable.

Everything runs client-side. State is persisted to `localStorage` through a
versioned store that migrates old data and recovers from corrupt data rather
than failing — see `src/lib/storage.ts`.

## Roadmap

Pro-rating for mid-month move-ins, utilities by room, and saved scenarios.

## Licence

MIT — see [LICENSE](./LICENSE).

---

Built by the [weekly app factory](https://github.com/oliverinhalo/Claude).
