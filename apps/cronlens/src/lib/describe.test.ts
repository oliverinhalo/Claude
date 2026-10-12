import { describe, expect, it } from 'vitest';
import { parseCron } from './cron';
import { describeSchedule } from './describe';

const d = (expr: string) => {
  const r = parseCron(expr);
  if (!r.ok) throw new Error(r.error);
  return describeSchedule(r.schedule);
};

describe('describeSchedule', () => {
  it.each([
    ['0 9 * * 1-5', 'At 09:00, Monday through Friday'],
    ['30 2 * * *', 'At 02:30, every day'],
    ['* * * * *', 'Every minute'],
    ['*/15 * * * *', 'Every 15 minutes, every day'],
    ['0 * * * *', 'Every hour, on the hour, every day'],
    ['5 * * * *', 'At minute 5 past every hour, every day'],
    ['0 9,17 * * *', 'At 09:00 and 17:00, every day'],
    ['0 0 1 * *', 'At 00:00, on day 1 of the month'],
    ['0 0 1,15 * *', 'At 00:00, on day 1 and 15 of the month'],
    ['0 0 * * 0', 'At 00:00, Sunday'],
    ['0 0 * * 6,0', 'At 00:00, Sunday and Saturday'],
    ['0 8 1 JAN,JUL *', 'At 08:00, on day 1 of the month, in January and July'],
    ['0 0 13 * 5', 'At 00:00, on day 13 of the month, or on Friday'],
    ['0 0 1 1 *', 'At 00:00, on day 1 of the month, in January'],
  ])('%s → %s', (expr, text) => {
    expect(d(expr)).toBe(text);
  });

  it('falls back to a compact form for busy schedules', () => {
    expect(d('0,10,20,30 9-17 * * *')).toBe(
      'At minute 0, 10, 20 and 30 past hour 9 to 17, every day',
    );
  });
});
