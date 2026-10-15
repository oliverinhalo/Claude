# Budgeter

Turn a UK salary into monthly take-home pay, then see what is left after your spending.

**[Open the app →](https://budgeter.pages.dev)**

No account. No tracking. Nothing leaves your browser.

---

## What it does

Type your annual salary and Budgeter shows what lands in your account each month, week and year after income tax, National Insurance, pension and student loan. Add your regular spending — "£5 a day for lunch, Monday to Friday" is a first-class case — and it shows what is left, and a ruled strip of where every pound of the year goes. A link copies the whole plan so you can send it to a partner or keep it.

## Why it exists

Take-home calculators stop at the pay slip; budgeting apps want a bank login. Working out whether you can afford a flat shouldn't need either.

## Basis and limits

2026/27, England, Wales and Northern Ireland, tax code 1257L. Personal allowance £12,570 (tapered above £100,000); 20% / 40% / 45% bands at £37,700 and £125,140 of taxable income; employee NI 8% to £50,270 then 2%; pension taken before tax; student loan 9% above Plan 1 £26,900, Plan 2 £29,385, Plan 4 £33,795, Plan 5 £25,000; postgraduate 6% above £21,000.

These are annual estimates, not payroll output. Not included: Scottish rates, bonuses, benefits in kind, salary sacrifice (NI saving), Marriage Allowance, second jobs, self-employment.

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

All maths is in `src/lib/tax.ts` and `src/lib/expenses.ts`, pure functions with tests against hand-checked figures. State is a single validated plan persisted to `localStorage` through a versioned store (`src/lib/storage.ts`) that recovers from corrupt data; share links carry the same plan as base64url JSON in the URL fragment, which never reaches a server.

## Roadmap

Scottish bands, salary sacrifice, other tax codes, a month-by-month view.

## Licence

MIT — see [LICENSE](./LICENSE).

---

Built by the [weekly app factory](https://github.com/oliverinhalo/Claude).
