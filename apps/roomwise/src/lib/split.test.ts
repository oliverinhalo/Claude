import { describe, expect, it } from 'vitest';

function at<T>(arr: readonly T[], i: number): T {
  const v = arr[i];
  if (v === undefined) throw new Error(`no item at ${i}`);
  return v;
}
import {
  apportion,
  compute,
  EXAMPLE,
  explain,
  formatAmount,
  summary,
  type State,
} from './split';

const base = (over: Partial<State> = {}): State => ({ ...EXAMPLE, ...over });

describe('apportion', () => {
  it('always sums to the total', () => {
    for (let n = 1; n <= 12; n++) {
      for (const total of [1, 99, 1000, 2100, 99999]) {
        const w = Array.from({ length: n }, (_, i) => 1 + ((i * 7919) % 13) / 3);
        expect(apportion(total, w).reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });
  it('returns zeros for zero weights', () => {
    expect(apportion(100, [0, 0])).toEqual([0, 0]);
  });
});

describe('compute', () => {
  it('splits the example and sums to the rent', () => {
    const r = compute(EXAMPLE);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.shares.reduce((s, x) => s + x.amount, 0)).toBe(2100);
      expect(at(r.shares, 0).amount).toBeGreaterThan(at(r.shares, 2).amount);
    }
  });
  it('a bigger room never pays less with identical perks', () => {
    const s = base({
      shared: 0,
      rooms: [
        { id: 'a', name: 'a', area: 10, perks: [] },
        { id: 'b', name: 'b', area: 10.5, perks: [] },
      ],
    });
    const r = compute(s);
    expect(r.ok && at(r.shares, 1).amount >= at(r.shares, 0).amount).toBe(true);
  });
  it('a positive perk raises that room and lowers the others', () => {
    const rooms = [
      { id: 'a', name: 'a', area: 10, perks: [] as string[] },
      { id: 'b', name: 'b', area: 10, perks: [] as string[] },
    ];
    const before = compute(base({ rooms, shared: 0 }));
    const after = compute(
      base({ rooms: [{ ...at(rooms, 0), perks: ['ensuite'] }, at(rooms, 1)], shared: 0 }),
    );
    expect(before.ok && after.ok).toBe(true);
    if (before.ok && after.ok) {
      expect(at(after.shares, 0).amount).toBeGreaterThan(at(before.shares, 0).amount);
      expect(at(after.shares, 1).amount).toBeLessThan(at(before.shares, 1).amount);
    }
  });
  it('never yields NaN for bad input', () => {
    for (const rent of [0, -5, NaN, Infinity]) {
      const r = compute(base({ rent }));
      expect(r.ok).toBe(false);
    }
    const r = compute(base({ rooms: [{ id: 'a', name: '', area: NaN, perks: [] }] }));
    expect(r.ok).toBe(false);
    expect(
      r.shares.every((s) => Number.isFinite(s.amount) && Number.isFinite(s.fraction)),
    ).toBe(true);
  });
  it('reports an empty house', () => {
    const r = compute(base({ rooms: [] }));
    expect(r.ok).toBe(false);
  });
  it('supports cents and still sums exactly', () => {
    const r = compute(base({ rent: 1000.01, cents: true }));
    expect(r.ok && r.total).toBe(100001);
    expect(r.ok && r.shares.reduce((s, x) => s + x.amount, 0)).toBe(100001);
  });
  it('ignores unknown perk ids', () => {
    const r = compute(base({ rooms: [{ id: 'a', name: 'a', area: 10, perks: ['ghost'] }] }));
    expect(r.ok).toBe(true);
  });
});

describe('text output', () => {
  it('formats and explains', () => {
    expect(formatAmount(2100, { cents: false, currency: '£' })).toBe('£2,100');
    expect(formatAmount(210050, { cents: true, currency: '$' })).toBe('$2,100.50');
    const r = compute(EXAMPLE);
    if (!r.ok) throw new Error('expected ok');
    expect(explain(at(r.shares, 0), 'm2')).toMatch(/18 m².*ensuite.*% of the rent/);
  });
  it('summary lists every room and the total', () => {
    const r = compute(EXAMPLE);
    const text = summary(EXAMPLE, r);
    expect(text).toContain('£2,100');
    for (const room of EXAMPLE.rooms) expect(text).toContain(room.name);
  });
});
