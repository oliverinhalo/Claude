# Budgeter — spec

**Budgeter** helps **a UK employee** work out **what they actually take home each month, and what is left after their regular spending**, in **under a minute**, without **a spreadsheet or an account**.

## Core loop

1. Open the page: a worked example (salary and a few expenses) is already on screen.
2. Type an annual salary; take-home (monthly, weekly, yearly) updates instantly.
3. Optionally set pension %, student loan plan, postgraduate loan.
4. Add an expense: name, amount, and how often — per day (with weekdays ticked), week, month or year.
5. See monthly spending total and the amount left over.
6. See where each pound of salary goes (tax, NI, loan, pension, spending, left).
7. Copy a link that reproduces the whole plan.

## Out of scope

Scotland's tax bands; tax codes other than 1257L; bonuses, benefits in kind, second jobs, self-employment; salary sacrifice for NI; Marriage Allowance; child benefit charge; accounts, sync, bank import; categories and charts over time; currencies other than GBP; part-year figures.

## Acceptance criteria

1. Salary £30,000, no pension/loan: tax £3,486, NI £1,394.40, annual take-home £25,119.60.
2. Salary £60,000: tax £11,432, NI £3,210.60.
3. Salary £125,140+ : personal allowance is £0; salary £100,000 tax is £27,432.
4. Pension % is deducted before tax and shown as its own line.
5. Plan 2 loan at £40,000 repays 9% of the amount above £29,385; postgraduate adds 6% above £21,000.
6. £5/day on Mon–Fri costs £108.33 a month; per-week ×52/12; per-month ×1; per-year ÷12.
7. Left over = monthly take-home − monthly expenses; negative is shown as a shortfall, in words, not just a sign.
8. Breakdown segments sum to the gross salary.
9. First load shows results with no input. Reload restores edits. Shared link restores the plan and overrides stored data.
10. Corrupt stored data or a corrupt link never crashes: it falls back to the example and says so.
11. Salary/amount inputs accept `£`, commas, spaces; reject negatives and non-numbers without throwing; are capped.
12. Whole core loop usable by keyboard; no axe violations in light or dark; no horizontal scroll at 320px.

## Data model

`localStorage` key `budgeter:state` (versioned envelope): `{ salary, pensionPct, loan, postgrad, expenses[] }`; expense = `{ id, name, amount, every, days[7] }`. Absent → seeded example. Invalid → example plus a notice. Links carry the same JSON, base64url, in `#p=`.

## States

- **Empty (no expenses):** "Nothing spent yet" with the add form focused-ready, take-home still shown.
- **Error:** invalid number shows an inline message beside the field; results keep the last valid value.
- **Slow:** nothing is asynchronous; calculation is synchronous.
- **Offline:** everything works after load; the footer says so.

## Tax basis

2026/27, England, Wales and Northern Ireland: personal allowance £12,570 (tapered above £100,000), 20% to £37,700 of taxable income, 40% to £125,140, 45% above; employee NI 8% between £12,570 and £50,270, 2% above; pension is taken before tax (net pay arrangement), NI is charged on full pay. Student loan thresholds: Plan 1 £26,900, Plan 2 £29,385, Plan 4 £33,795, Plan 5 £25,000 (9%); postgraduate £21,000 (6%). Annual estimates, not payroll output.
