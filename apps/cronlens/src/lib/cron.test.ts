import { describe, expect, it } from 'vitest';
import { dayMatches, parseCron, timesOfDay, wallMatches, type Schedule } from './cron';

function ok(expr: string): Schedule {
  const r = parseCron(expr);
  if (!r.ok) throw new Error(r.error);
  return r.schedule;
}
const err = (expr: string) => {
  const r = parseCron(expr);
  return r.ok ? null : r.error;
};

describe('parseCron', () => {
  it('parses a plain daily time', () => {
    const s = ok('30 2 * * *');
    expect(s.minutes).toEqual([30]);
    expect(s.hours).toEqual([2]);
    expect(timesOfDay(s)).toEqual([150]);
  });

  it('expands steps to 96 times per day', () => {
    expect(timesOfDay(ok('*/15 * * * *'))).toHaveLength(96);
  });

  it('handles lists, ranges and range steps', () => {
    expect(ok('0 9-17/4 * * *').hours).toEqual([9, 13, 17]);
    expect(ok('5,10,5 * * * *').minutes).toEqual([5, 10]);
    expect(ok('0 8/6 * * *').hours).toEqual([8, 14, 20]);
  });

  it('accepts names and 7 as Sunday', () => {
    expect(ok('0 0 * JAN-MAR MON-FRI').months).toEqual([1, 2, 3]);
    expect(ok('0 0 * * mon-fri').dows).toEqual([1, 2, 3, 4, 5]);
    expect(ok('0 0 * * 7').dows).toEqual([0]);
    expect(ok('0 0 * * 5-7').dows).toEqual([0, 5, 6]);
  });

  it('expands macros', () => {
    expect(ok('@daily').hours).toEqual([0]);
    expect(ok('@hourly').minutes).toEqual([0]);
    expect(ok('@weekly').dows).toEqual([0]);
    expect(ok('@monthly').doms).toEqual([1]);
  });

  it.each([
    ['', /Type a cron expression/],
    ['61 * * * *', /outside the minute range 0–59/],
    ['* * * *', /4 fields/],
    ['* * * * * *', /6 fields/],
    ['0 0 L * *', /Quartz/],
    ['5-1 * * * *', /backwards/],
    ['*/0 * * * *', /step/],
    ['a * * * *', /not a number in the minute field/],
    ['1,,2 * * * *', /stray comma/],
    ['@reboot', /boot/],
    ['@fortnightly', /not a macro/],
    ['0 24 * * *', /outside the hour range 0–23/],
  ])('rejects %j with a specific message', (expr, pattern) => {
    expect(err(expr)).toMatch(pattern);
  });
});

describe('day matching', () => {
  it('ANDs a star with the other day field', () => {
    const s = ok('0 0 * * 1');
    expect(dayMatches(s, 2025, 3, 10)).toBe(true); // Monday
    expect(dayMatches(s, 2025, 3, 11)).toBe(false);
  });

  it('ORs day-of-month and day-of-week when both are restricted', () => {
    const s = ok('0 0 13 * 5');
    expect(dayMatches(s, 2025, 6, 13)).toBe(true); // Friday the 13th
    expect(dayMatches(s, 2025, 6, 20)).toBe(true); // Friday
    expect(dayMatches(s, 2025, 6, 14)).toBe(false);
    expect(dayMatches(s, 2025, 7, 13)).toBe(true); // Sunday the 13th
  });

  it('respects the month field', () => {
    expect(dayMatches(ok('0 0 1 6 *'), 2025, 7, 1)).toBe(false);
  });

  it('matches wall readings', () => {
    const s = ok('30 2 * * *');
    expect(wallMatches(s, Date.UTC(2025, 2, 9, 2, 30))).toBe(true);
    expect(wallMatches(s, Date.UTC(2025, 2, 9, 2, 31))).toBe(false);
  });
});

describe('error text', () => {
  it('clips echoed tokens so a huge paste cannot blow up the layout', () => {
    expect((err(`${'9'.repeat(50_000)} * * * *`) ?? '').length).toBeLessThan(200);
  });
  it('uses the singular for one field', () => {
    expect(err('*')).toMatch(/1 field;/);
  });
});
