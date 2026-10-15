/** UK 2026/27 (England, Wales, Northern Ireland). Annual estimates, in pounds. */

export type LoanPlan = 'none' | 'plan1' | 'plan2' | 'plan4' | 'plan5';

export const LOAN_THRESHOLDS: Record<Exclude<LoanPlan, 'none'>, number> = {
  plan1: 26_900,
  plan2: 29_385,
  plan4: 33_795,
  plan5: 25_000,
};
export const LOAN_LABELS: Record<LoanPlan, string> = {
  none: 'No student loan',
  plan1: 'Plan 1',
  plan2: 'Plan 2',
  plan4: 'Plan 4',
  plan5: 'Plan 5',
};

const PERSONAL_ALLOWANCE = 12_570;
const TAPER_START = 100_000;
const BASIC_BAND = 37_700;
const HIGHER_LIMIT = 125_140;
const NI_THRESHOLD = 12_570;
const NI_UPPER = 50_270;
const POSTGRAD_THRESHOLD = 21_000;

export interface PayInput {
  salary: number;
  /** Percent of salary paid into a pension before tax, 0–100. */
  pensionPct: number;
  loan: LoanPlan;
  postgrad: boolean;
}

export interface PayResult {
  gross: number;
  pension: number;
  tax: number;
  ni: number;
  loan: number;
  takeHome: number;
}

const pos = (n: number) => Math.max(0, n);

export function incomeTax(taxable: number): number {
  const allowance = pos(PERSONAL_ALLOWANCE - pos(taxable - TAPER_START) / 2);
  const ti = pos(taxable - allowance);
  const basic = Math.min(ti, BASIC_BAND) * 0.2;
  const higher = pos(Math.min(ti, HIGHER_LIMIT) - BASIC_BAND) * 0.4;
  const additional = pos(ti - HIGHER_LIMIT) * 0.45;
  return basic + higher + additional;
}

export function nationalInsurance(gross: number): number {
  return pos(Math.min(gross, NI_UPPER) - NI_THRESHOLD) * 0.08 + pos(gross - NI_UPPER) * 0.02;
}

export function studentLoan(gross: number, plan: LoanPlan, postgrad: boolean): number {
  const main = plan === 'none' ? 0 : pos(gross - LOAN_THRESHOLDS[plan]) * 0.09;
  const pg = postgrad ? pos(gross - POSTGRAD_THRESHOLD) * 0.06 : 0;
  return main + pg;
}

export function calculatePay(input: PayInput): PayResult {
  const gross = pos(input.salary);
  const pension = gross * (Math.min(100, pos(input.pensionPct)) / 100);
  const tax = incomeTax(gross - pension);
  const ni = nationalInsurance(gross);
  const loan = studentLoan(gross, input.loan, input.postgrad);
  return { gross, pension, tax, ni, loan, takeHome: pos(gross - pension - tax - ni - loan) };
}
