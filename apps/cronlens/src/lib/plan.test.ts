import { describe, expect, it } from 'vitest';
import { parseCron } from './cron';
import { analyse, nextRuns, suggestSafe } from './plan';

const NY = 'America/New_York';
const sched = (expr: string) => {
  const r = parseCron(expr);
  if (!r.ok) throw new Error(r.error);
  return r.schedule;
};
const wall = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);

describe('nextRuns', () => {
  it('returns ten ascending runs', () => {
    const runs = nextRuns(sched('*/20 * * * *'), NY, Date.UTC(2025, 5, 1), 10);
    expect(runs).toHaveLength(10);
    for (let i = 1; i < runs.length; i++)
      expect(runs[i]?.instant ?? 0).toBeGreaterThan(runs[i - 1]?.instant ?? 0);
  });

  it('omits a skipped time (2025-03-09 02:30 does not exist in New York)', () => {
    const runs = nextRuns(sched('30 2 * * *'), NY, Date.UTC(2025, 2, 8, 12), 3);
    expect(runs.map((r) => r.wall)).toEqual([
      wall(2025, 3, 10, 2, 30),
      wall(2025, 3, 11, 2, 30),
      wall(2025, 3, 12, 2, 30),
    ]);
  });

  it('lists a repeated time twice, an hour apart (2025-11-02 01:30)', () => {
    const runs = nextRuns(sched('30 1 * * *'), NY, Date.UTC(2025, 10, 1, 12), 3);
    expect(runs).toHaveLength(3);
    expect(runs[0]?.wall).toBe(wall(2025, 11, 2, 1, 30));
    expect(runs[1]?.wall).toBe(wall(2025, 11, 2, 1, 30));
    expect((runs[1]?.instant ?? 0) - (runs[0]?.instant ?? 0)).toBe(3_600_000);
  });

  it('skips runs at or before now', () => {
    const now = Date.UTC(2025, 5, 1, 6, 30); // exactly 02:30 EDT
    expect(nextRuns(sched('30 2 * * *'), NY, now, 1)[0]?.wall).toBe(wall(2025, 6, 2, 2, 30));
  });

  it('finds a leap-day schedule within the search window', () => {
    const runs = nextRuns(sched('0 0 29 2 *'), 'UTC', Date.UTC(2025, 0, 1), 1);
    expect(runs[0]?.wall).toBe(wall(2028, 2, 29));
  });

  it('copes with a day that does not exist (Apia 2011-12-30)', () => {
    const runs = nextRuns(sched('0 12 * * *'), 'Pacific/Apia', Date.UTC(2011, 11, 29, 12), 3);
    expect(runs.map((r) => r.wall)).toEqual([
      wall(2011, 12, 29, 12),
      wall(2011, 12, 31, 12),
      wall(2012, 1, 1, 12),
    ]);
  });

  it('returns nothing for an impossible date', () => {
    expect(nextRuns(sched('0 0 31 2 *'), 'UTC', Date.UTC(2025, 0, 1), 10)).toEqual([]);
  });
});

describe('analyse', () => {
  const ana = (expr: string, zone: string, now: number) => {
    const r = analyse(expr, zone, now);
    if (!r.ok) throw new Error(r.error);
    return r.analysis;
  };

  it('flags the New York example from either side of the year', () => {
    for (const now of [Date.UTC(2025, 0, 1), Date.UTC(2025, 5, 1)]) {
      const a = ana('30 2 * * *', NY, now);
      expect(a.hazardCount).toBeGreaterThanOrEqual(1);
      expect(
        a.changes.some((c) => c.change.kind === 'skipped' && c.affected.length === 1),
      ).toBe(true);
    }
  });

  it('reports 2025-03-09 02:30 as skipped and 01:30 as doubled in New York', () => {
    const a = ana('30 1,2 * * *', NY, Date.UTC(2025, 0, 1));
    expect(a.changes[0]?.affected.map((x) => x.wall)).toEqual([wall(2025, 3, 9, 2, 30)]);
    expect(a.changes[1]?.change.kind).toBe('doubled');
    expect(a.changes[1]?.affected.map((x) => x.wall)).toEqual([wall(2025, 11, 2, 1, 30)]);
    expect(a.hazardCount).toBe(2);
  });

  it('counts zero hazards where the schedule avoids the changed hour', () => {
    expect(ana('0 9 * * *', NY, Date.UTC(2025, 0, 1)).hazardCount).toBe(0);
  });

  it('counts zero in zones without changes', () => {
    expect(ana('30 2 * * *', 'Asia/Kolkata', Date.UTC(2025, 0, 1)).hazardCount).toBe(0);
    expect(ana('30 2 * * *', 'America/Phoenix', Date.UTC(2025, 0, 1)).changes).toEqual([]);
  });

  it('does not flag a change on a day the schedule does not run', () => {
    // 2025-03-09 is a Sunday; weekdays only.
    const a = ana('30 2 * * 1-5', NY, Date.UTC(2025, 0, 1));
    expect(a.hazardCount).toBe(0);
  });

  it('plots the schedule across the change day', () => {
    const a = ana('0 1,2,3 * * *', NY, Date.UTC(2025, 0, 1));
    expect(a.changes[0]?.dayRuns).toHaveLength(3);
  });

  it('passes parse errors through', () => {
    const r = analyse('61 * * * *', NY, 0);
    expect(r.ok).toBe(false);
  });

  it('reports a schedule that never runs', () => {
    expect(ana('0 0 31 2 *', 'UTC', Date.UTC(2025, 0, 1)).neverRuns).toBe(true);
  });
});

describe('suggestSafe', () => {
  const now = Date.UTC(2026, 0, 15);
  it('moves a 02:30 New York job to 03:30', () => {
    const s = suggestSafe('30 2 * * *', 'America/New_York', now);
    expect(s).toEqual({ expr: '30 3 * * *', shiftHours: 1 });
  });
  it('returns null when already safe', () => {
    expect(suggestSafe('30 12 * * *', 'America/New_York', now)).toBeNull();
  });
  it('returns null in a zone without clock changes', () => {
    expect(suggestSafe('30 2 * * *', 'Asia/Tokyo', now)).toBeNull();
  });
  it('returns null for invalid input and every-hour schedules', () => {
    expect(suggestSafe('nope', 'America/New_York', now)).toBeNull();
    expect(suggestSafe('30 * * * *', 'America/New_York', now)).toBeNull();
  });
  it('keeps the suggestion itself free of hazards', () => {
    const s = suggestSafe('15 1,2 * * *', 'Europe/London', now);
    if (!s) throw new Error('expected a suggestion');
    const r = analyse(s.expr, 'Europe/London', now);
    expect(r.ok && r.analysis.hazardCount).toBe(0);
  });
});
