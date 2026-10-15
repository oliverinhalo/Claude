import { createStore } from './storage';
import type { LoanPlan } from './tax';
import type { Every, Expense } from './expenses';

export interface Plan {
  salary: number;
  pensionPct: number;
  loan: LoanPlan;
  postgrad: boolean;
  expenses: Expense[];
}

const WEEKDAYS = [true, true, true, true, true, false, false];
const NO_DAYS = [false, false, false, false, false, false, false];

export const EXAMPLE_PLAN: Plan = {
  salary: 35_000,
  pensionPct: 5,
  loan: 'none',
  postgrad: false,
  expenses: [
    { id: 'ex-lunch', name: 'Lunch', amount: 5, every: 'day', days: WEEKDAYS },
    { id: 'ex-rent', name: 'Rent', amount: 850, every: 'month', days: NO_DAYS },
    { id: 'ex-phone', name: 'Phone', amount: 18, every: 'month', days: NO_DAYS },
  ],
};

export const MAX_EXPENSES = 100;
const LOANS: readonly string[] = ['none', 'plan1', 'plan2', 'plan4', 'plan5'];
const EVERYS: readonly string[] = ['day', 'week', 'month', 'year'];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const money = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10_000_000;

function isExpense(v: unknown): v is Expense {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    v.name.length <= 80 &&
    money(v.amount) &&
    typeof v.every === 'string' &&
    EVERYS.includes(v.every) &&
    Array.isArray(v.days) &&
    v.days.length === 7 &&
    v.days.every((d) => typeof d === 'boolean')
  );
}

export function isPlan(v: unknown): v is Plan {
  return (
    isObj(v) &&
    money(v.salary) &&
    typeof v.pensionPct === 'number' &&
    v.pensionPct >= 0 &&
    v.pensionPct <= 100 &&
    typeof v.loan === 'string' &&
    LOANS.includes(v.loan) &&
    typeof v.postgrad === 'boolean' &&
    Array.isArray(v.expenses) &&
    v.expenses.length <= MAX_EXPENSES &&
    v.expenses.every(isExpense)
  );
}

export const planStore = createStore<Plan>({
  key: 'budgeter:state',
  version: 1,
  fallback: EXAMPLE_PLAN,
  validate: isPlan,
});

let counter = 0;
export const newId = (): string => `e${Date.now().toString(36)}${(counter++).toString(36)}`;

export function blankExpense(every: Every = 'day'): Expense {
  return { id: newId(), name: '', amount: 0, every, days: [...WEEKDAYS] };
}

// ---- share links -------------------------------------------------------

export function encodePlan(plan: Plan): string {
  const bytes = new TextEncoder().encode(JSON.stringify(plan));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Returns null for anything that is not a valid plan. Never throws. */
export function decodePlan(encoded: string): Plan | null {
  try {
    if (encoded.length > 40_000) return null;
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isPlan(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function planFromHash(hash: string): Plan | null | 'none' {
  const m = /^#p=([\w-]+)$/.exec(hash);
  if (!m?.[1]) return 'none';
  return decodePlan(m[1]);
}
