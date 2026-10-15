import { beforeEach, describe, expect, it } from 'vitest';
import { EXAMPLE_PLAN, decodePlan, encodePlan, isPlan, planFromHash, planStore } from './plan';

beforeEach(() => localStorage.clear());

describe('plan validation', () => {
  it('accepts the example', () => expect(isPlan(EXAMPLE_PLAN)).toBe(true));
  it.each([
    ['negative salary', { ...EXAMPLE_PLAN, salary: -1 }],
    ['bad loan', { ...EXAMPLE_PLAN, loan: 'plan9' }],
    ['pension > 100', { ...EXAMPLE_PLAN, pensionPct: 101 }],
    [
      'NaN amount',
      { ...EXAMPLE_PLAN, expenses: [{ ...EXAMPLE_PLAN.expenses[0], amount: NaN }] },
    ],
    [
      'short days',
      { ...EXAMPLE_PLAN, expenses: [{ ...EXAMPLE_PLAN.expenses[0], days: [true] }] },
    ],
    ['null', null],
  ])('rejects %s', (_n, v) => expect(isPlan(v)).toBe(false));
});

describe('share links', () => {
  it('round-trips, including non-ASCII names', () => {
    const plan = {
      ...EXAMPLE_PLAN,
      expenses: EXAMPLE_PLAN.expenses.map((e) => ({ ...e, name: 'Café ☕ 食' })),
    };
    expect(decodePlan(encodePlan(plan))).toEqual(plan);
  });
  it('returns null for garbage rather than throwing', () => {
    expect(decodePlan('%%%')).toBeNull();
    expect(decodePlan('abcd')).toBeNull();
    expect(decodePlan('a'.repeat(50_000))).toBeNull();
  });
  it('distinguishes no link from a bad link', () => {
    expect(planFromHash('')).toBe('none');
    expect(planFromHash('#other')).toBe('none');
    expect(planFromHash('#p=bm90anNvbg')).toBeNull();
    expect(planFromHash(`#p=${encodePlan(EXAMPLE_PLAN)}`)).toEqual(EXAMPLE_PLAN);
  });
});

describe('persistence', () => {
  it('returns the example when empty and recovers from corruption', () => {
    expect(planStore.load().status).toBe('default');
    localStorage.setItem(planStore.key, 'garbage');
    expect(planStore.load().status).toBe('recovered');
  });
  it('round-trips', () => {
    const p = { ...EXAMPLE_PLAN, salary: 52_000 };
    planStore.save(p);
    expect(planStore.load()).toEqual({ status: 'loaded', value: p });
  });
});
