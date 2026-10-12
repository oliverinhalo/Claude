import { describe, expect, it } from 'vitest';
import {
  clockChanges,
  formatOffset,
  isValidZone,
  offsetAt,
  wallAt,
  wallToInstants,
} from './zone';

const H = 3_600_000;
const wall = (y: number, mo: number, d: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, d, h, mi);

describe('offsetAt', () => {
  it('knows New York in winter and summer', () => {
    expect(offsetAt(Date.UTC(2025, 0, 15, 12), 'America/New_York')).toBe(-5 * H);
    expect(offsetAt(Date.UTC(2025, 6, 15, 12), 'America/New_York')).toBe(-4 * H);
  });
  it('knows half-hour zones', () => {
    expect(offsetAt(Date.UTC(2025, 0, 15), 'Asia/Kolkata')).toBe(5.5 * H);
  });
  it('is zero for UTC', () => {
    expect(offsetAt(Date.UTC(2025, 0, 15), 'UTC')).toBe(0);
  });
  it('ignores sub-second noise', () => {
    expect(offsetAt(Date.UTC(2025, 0, 15, 12) + 999, 'America/New_York')).toBe(-5 * H);
  });
});

describe('wallAt', () => {
  it('reads the wall clock', () => {
    expect(wallAt(Date.UTC(2025, 0, 15, 12), 'America/New_York')).toBe(wall(2025, 1, 15, 7));
  });
});

describe('wallToInstants', () => {
  it('returns one instant on an ordinary day', () => {
    expect(wallToInstants(wall(2025, 6, 1, 2, 30), 'America/New_York')).toEqual([
      Date.UTC(2025, 5, 1, 6, 30),
    ]);
  });
  it('returns none for a skipped time (New York, 2025-03-09 02:30)', () => {
    expect(wallToInstants(wall(2025, 3, 9, 2, 30), 'America/New_York')).toEqual([]);
  });
  it('returns two for a repeated time (New York, 2025-11-02 01:30), an hour apart', () => {
    const r = wallToInstants(wall(2025, 11, 2, 1, 30), 'America/New_York');
    expect(r).toHaveLength(2);
    expect((r[1] ?? 0) - (r[0] ?? 0)).toBe(H);
  });
  it('handles a 30-minute shift (Lord Howe, 2025-10-05 02:15 is skipped)', () => {
    expect(wallToInstants(wall(2025, 10, 5, 2, 15), 'Australia/Lord_Howe')).toEqual([]);
    expect(wallToInstants(wall(2025, 10, 5, 2, 45), 'Australia/Lord_Howe')).toHaveLength(1);
  });
  it('handles a skipped whole day (Apia, 2011-12-30)', () => {
    expect(wallToInstants(wall(2011, 12, 30, 12), 'Pacific/Apia')).toEqual([]);
    expect(wallToInstants(wall(2011, 12, 31, 12), 'Pacific/Apia')).toHaveLength(1);
  });
  it('round-trips: every returned instant reads back as the wall time', () => {
    for (const z of [
      'America/New_York',
      'Europe/London',
      'Australia/Lord_Howe',
      'Asia/Kolkata',
    ]) {
      for (let m = 0; m < 24 * 60 * 3; m += 17) {
        const w = wall(2025, 3, 29) + m * 60_000;
        for (const t of wallToInstants(w, z)) expect(wallAt(t, z)).toBe(w);
      }
    }
  });
});

describe('clockChanges', () => {
  const start = Date.UTC(2025, 0, 1);
  const end = Date.UTC(2026, 0, 1);

  it('finds both New York changes in 2025', () => {
    const c = clockChanges('America/New_York', start, end);
    expect(c.map((x) => x.kind)).toEqual(['skipped', 'doubled']);
    expect(c[0]?.at).toBe(Date.UTC(2025, 2, 9, 7, 0));
    expect(c[0]?.from).toBe(wall(2025, 3, 9, 2));
    expect(c[0]?.to).toBe(wall(2025, 3, 9, 3));
    expect(c[1]?.at).toBe(Date.UTC(2025, 10, 2, 6, 0));
    expect(c[1]?.from).toBe(wall(2025, 11, 2, 1));
    expect(c[1]?.to).toBe(wall(2025, 11, 2, 2));
  });
  it('finds none where clocks never change', () => {
    expect(clockChanges('Asia/Kolkata', start, end)).toEqual([]);
    expect(clockChanges('America/Phoenix', start, end)).toEqual([]);
    expect(clockChanges('UTC', start, end)).toEqual([]);
  });
  it('reports half-hour changes at their real size (Lord Howe)', () => {
    const c = clockChanges('Australia/Lord_Howe', start, end);
    expect(c).toHaveLength(2);
    expect((c[0]?.to ?? 0) - (c[0]?.from ?? 0)).toBe(H / 2);
  });
  it('finds a midnight change (Havana skips 00:00–01:00)', () => {
    const c = clockChanges('America/Havana', start, end);
    expect(c.some((x) => x.kind === 'skipped' && x.from % (24 * H) === 0)).toBe(true);
  });
  it('finds the Apia dateline jump as one 24 h skip', () => {
    const c = clockChanges('Pacific/Apia', Date.UTC(2011, 11, 1), Date.UTC(2012, 0, 31));
    expect(c).toHaveLength(1);
    expect((c[0]?.to ?? 0) - (c[0]?.from ?? 0)).toBe(24 * H);
  });
});

describe('helpers', () => {
  it('validates zones', () => {
    expect(isValidZone('Europe/Paris')).toBe(true);
    expect(isValidZone('Mars/Olympus')).toBe(false);
    expect(isValidZone('')).toBe(false);
  });
  it('formats offsets', () => {
    expect(formatOffset(-5 * H)).toBe('UTC−5');
    expect(formatOffset(5.5 * H)).toBe('UTC+5:30');
    expect(formatOffset(0)).toBe('UTC');
  });
});

describe('allZones', () => {
  it('lists modern names, UTC first, with no duplicates', async () => {
    const { allZones } = await import('./zone');
    const zones = allZones();
    expect(zones[0]).toBe('UTC');
    expect(zones).toContain('Asia/Kolkata');
    expect(zones).not.toContain('Asia/Calcutta');
    expect(new Set(zones).size).toBe(zones.length);
  });
});
