import { describe, expect, it } from 'vitest';
import { calculatePay, incomeTax, nationalInsurance, studentLoan } from './tax';

const pay = (salary: number, extra: object = {}) =>
  calculatePay({ salary, pensionPct: 0, loan: 'none', postgrad: false, ...extra });

describe('income tax', () => {
  it('is zero within the personal allowance', () => {
    expect(incomeTax(12_570)).toBe(0);
    expect(incomeTax(0)).toBe(0);
  });
  it('matches known figures', () => {
    expect(incomeTax(30_000)).toBeCloseTo(3_486, 2);
    expect(incomeTax(60_000)).toBeCloseTo(11_432, 2);
    expect(incomeTax(100_000)).toBeCloseTo(27_432, 2);
  });
  it('tapers the allowance to nothing at £125,140', () => {
    // 7,540 + 0.4 × (125,140 − 37,700) = 42,516
    expect(incomeTax(125_140)).toBeCloseTo(42_516, 2);
    expect(incomeTax(125_141)).toBeCloseTo(42_516.45, 2);
  });
  it('has the 60% effective rate between £100k and £125,140', () => {
    expect(incomeTax(110_000) - incomeTax(100_000)).toBeCloseTo(6_000, 2);
  });
});

describe('national insurance', () => {
  it('matches known figures', () => {
    expect(nationalInsurance(12_570)).toBe(0);
    expect(nationalInsurance(30_000)).toBeCloseTo(1_394.4, 2);
    expect(nationalInsurance(60_000)).toBeCloseTo(3_210.6, 2);
  });
});

describe('student loans', () => {
  it('charges 9% above the plan threshold', () => {
    expect(studentLoan(40_000, 'plan2', false)).toBeCloseTo(0.09 * (40_000 - 29_385), 2);
    expect(studentLoan(29_000, 'plan2', false)).toBe(0);
  });
  it('adds 6% postgraduate above £21,000', () => {
    expect(studentLoan(40_000, 'none', true)).toBeCloseTo(0.06 * 19_000, 2);
    expect(studentLoan(40_000, 'plan5', true)).toBeCloseTo(0.09 * 15_000 + 0.06 * 19_000, 2);
  });
});

describe('calculatePay', () => {
  it('gives £25,119.60 at £30,000', () => {
    expect(pay(30_000).takeHome).toBeCloseTo(25_119.6, 2);
  });
  it('takes pension before tax but not before NI', () => {
    const r = pay(30_000, { pensionPct: 10 });
    expect(r.pension).toBe(3_000);
    expect(r.tax).toBeCloseTo(incomeTax(27_000), 2);
    expect(r.ni).toBeCloseTo(1_394.4, 2);
  });
  it('parts always sum to gross', () => {
    const r = pay(87_654, { pensionPct: 7, loan: 'plan1', postgrad: true });
    expect(r.pension + r.tax + r.ni + r.loan + r.takeHome).toBeCloseTo(r.gross, 6);
  });
  it('clamps nonsense input', () => {
    expect(pay(-5).takeHome).toBe(0);
    expect(pay(30_000, { pensionPct: 500 }).takeHome).toBe(0);
  });
});
