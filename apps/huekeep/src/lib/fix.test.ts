import { describe, expect, it } from 'vitest';
import { contrast, hueDelta, parseColor, rgbToOklch, type RGB } from './color';
import { nearestPassing, ribbon, solve, type Target } from './fix';

const rgb = (s: string): RGB => {
  const r = parseColor(s);
  if (!r.ok) throw new Error(r.reason);
  return r.rgb;
};

describe('solve', () => {
  it('reports a passing pair as passing with no fixes', () => {
    const o = solve(rgb('#000'), rgb('#fff'), 4.5);
    expect(o.status).toBe('passes');
  });

  it('fixes orange on white and the result passes after 8-bit rounding', () => {
    const fg = rgb('#e8590c');
    const bg = rgb('#ffffff');
    const o = solve(fg, bg, 4.5);
    expect(o.status).toBe('fixable');
    if (o.status !== 'fixable') return;
    for (const fix of o.fixes) {
      const other = fix.role === 'text' ? bg : fg;
      expect(contrast(fix.rgb, other)).toBeGreaterThanOrEqual(4.5);
      expect(fix.ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps hue within 2° for chromatic colours', () => {
    for (const hex of ['#e8590c', '#1a73e8', '#2e9e5b', '#c026d3', '#d4a017']) {
      const fg = rgb(hex);
      const fix = nearestPassing(fg, rgb('#ffffff'), 4.5, 'text');
      expect(fix, hex).not.toBeNull();
      if (!fix) continue;
      expect(hueDelta(rgbToOklch(fix.rgb).h, rgbToOklch(fg).h), hex).toBeLessThan(2);
    }
  });

  it('moves a pass-by-a-hair colour a barely-visible distance', () => {
    const fix = nearestPassing(rgb('#777777'), rgb('#fff'), 4.5, 'text');
    expect(fix?.hex).toBe('#767676');
    expect(fix?.moved).toBeLessThan(1);
  });

  it('prefers the smaller move and sorts fixes by it', () => {
    const o = solve(rgb('#8a8f98'), rgb('#ffffff'), 4.5);
    if (o.status !== 'fixable') throw new Error('expected fixable');
    const moves = o.fixes.map((f) => f.moved);
    expect(moves).toEqual([...moves].sort((a, b) => a - b));
  });

  it('goes lighter on a dark background', () => {
    const fix = nearestPassing(rgb('#444444'), rgb('#111111'), 4.5, 'text');
    expect(fix?.direction).toBe('lighter');
  });

  it('is impossible when only one role can move and it cannot reach the target', () => {
    // 7:1 against mid-grey cannot be reached by either black or white text.
    const o = solve(rgb('#777777'), rgb('#808080'), 7);
    expect(o.status).toBe('impossible');
    if (o.status === 'impossible') expect(o.impossible).toEqual(['text', 'background']);
  });

  it('flags when one role is impossible but the other works', () => {
    const o = solve(rgb('#ffffff'), rgb('#ffffff'), 7);
    expect(o.status).toBe('fixable');
  });

  it.each([3, 4.5, 7] as Target[])('always reaches %s when it returns a fix, across a colour sweep', (target) => {
    for (let h = 0; h < 360; h += 40) {
      for (const l of [20, 50, 80]) {
        const fg = rgb(`hsl(${h} 70% ${l}%)`);
        const bg = rgb('hsl(40 20% 96%)');
        const o = solve(fg, bg, target);
        if (o.status === 'fixable') {
          for (const f of o.fixes) {
            expect(contrast(f.rgb, f.role === 'text' ? bg : fg)).toBeGreaterThanOrEqual(target);
          }
        }
      }
    }
  });

  it('solves in well under 100 ms', () => {
    const t = performance.now();
    solve(rgb('#e8590c'), rgb('#ffffff'), 7);
    expect(performance.now() - t).toBeLessThan(100);
  });
});

describe('ribbon', () => {
  it('marks passing zones against the fixed colour', () => {
    const r = ribbon(rgb('#e8590c'), rgb('#fff'), 4.5);
    expect(r[0]?.pass).toBe(true); // near black passes on white
    expect(r.at(-1)?.pass).toBe(false); // near white fails on white
  });
});
