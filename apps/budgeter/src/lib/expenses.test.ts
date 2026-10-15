import { describe, expect, it } from 'vitest';
import { monthlyCost, parseMoney, totalMonthly, type Expense } from './expenses';

const ex = (o: Partial<Expense>): Expense => ({
  id: 'x',
  name: 'x',
  amount: 5,
  every: 'day',
  days: [true, true, true, true, true, false, false],
  ...o,
});

describe('monthlyCost', () => {
  it('£5 a day Mon–Fri is £108.33 a month', () => {
    expect(monthlyCost(ex({}))).toBeCloseTo(108.33, 2);
  });
  it('is zero when no days are ticked', () => {
    expect(monthlyCost(ex({ days: Array(7).fill(false) as boolean[] }))).toBe(0);
  });
  it('converts weekly, monthly and yearly', () => {
    expect(monthlyCost(ex({ every: 'week', amount: 12 }))).toBeCloseTo(52, 6);
    expect(monthlyCost(ex({ every: 'month', amount: 40 }))).toBe(40);
    expect(monthlyCost(ex({ every: 'year', amount: 120 }))).toBe(10);
  });
  it('totals', () => {
    expect(totalMonthly([ex({ every: 'month' }), ex({ every: 'month', amount: 7 })])).toBe(12);
    expect(totalMonthly([])).toBe(0);
  });
});

describe('parseMoney', () => {
  it('accepts currency formatting', () => {
    expect(parseMoney('£1,200.50')).toBe(1200.5);
    expect(parseMoney(' 1 200 ')).toBe(1200);
    expect(parseMoney('.5')).toBe(0.5);
  });
  it.each(['', '-5', 'abc', '1e9', '.', '1.2.3', '99999999999'])('rejects %j', (t) => {
    expect(parseMoney(t)).toBeNull();
  });
  it('survives a huge paste', () => {
    expect(parseMoney('9'.repeat(50_000))).toBeNull();
  });
});
