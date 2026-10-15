export type Every = 'day' | 'week' | 'month' | 'year';

export const EVERY_LABELS: Record<Every, string> = {
  day: 'a day',
  week: 'a week',
  month: 'a month',
  year: 'a year',
};
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface Expense {
  id: string;
  name: string;
  /** Pounds per occurrence. */
  amount: number;
  every: Every;
  /** Mon..Sun; only read when `every` is 'day'. */
  days: boolean[];
}

export function annualCost(e: Expense): number {
  switch (e.every) {
    case 'day':
      return e.amount * e.days.filter(Boolean).length * 52;
    case 'week':
      return e.amount * 52;
    case 'month':
      return e.amount * 12;
    case 'year':
      return e.amount;
  }
}

export const monthlyCost = (e: Expense): number => annualCost(e) / 12;

export const totalMonthly = (list: readonly Expense[]): number =>
  list.reduce((sum, e) => sum + monthlyCost(e), 0);

/** Lenient money parse: accepts "£1,200.50", " 1 200 ". Returns null if not a usable amount. */
export function parseMoney(text: string, max = 10_000_000): number | null {
  const cleaned = text.replace(/[£,\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n > max) return null;
  return n;
}
