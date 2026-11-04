import { describe, expect, it } from 'vitest';
import {
  contrast,
  formatRatio,
  hueDelta,
  oklchToRgb,
  parseColor,
  rgbToOklch,
  toHex,
  type RGB,
} from './color';

const rgb = (s: string): RGB => {
  const r = parseColor(s);
  if (!r.ok) throw new Error(r.reason);
  return r.rgb;
};

describe('parseColor', () => {
  it.each([
    ['#fff', '#ffffff'],
    ['#1A73E8', '#1a73e8'],
    ['1a73e8', '#1a73e8'],
    ['rgb(26, 115, 232)', '#1a73e8'],
    ['rgb(26 115 232)', '#1a73e8'],
    ['rgb(10% 20% 30%)', '#1a334d'],
    ['hsl(0 100% 50%)', '#ff0000'],
    ['hsl(120deg, 100%, 25%)', '#008000'],
    ['navy', '#000080'],
    ['  White ', '#ffffff'],
    ['rgba(0,0,0,1)', '#000000'],
  ])('reads %s', (input, hex) => {
    expect(toHex(rgb(input))).toBe(hex);
  });

  it.each([
    '',
    '   ',
    '#12',
    '#12345',
    'rgb(1,2)',
    'rgb(a b c)',
    'hsl(1 2 3)',
    'banana',
    '#ggg',
  ])('rejects %j with a reason', (input) => {
    const r = parseColor(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.length).toBeGreaterThan(10);
  });

  it.each(['#ff000080', '#f008', 'rgba(0,0,0,0.5)', 'transparent'])(
    'explains transparency in %s',
    (input) => {
      const r = parseColor(input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/transparen|solid/i);
    },
  );

  it('rejects 50,000 characters quickly', () => {
    const t = performance.now();
    const r = parseColor('#'.padEnd(50_000, 'a'));
    expect(r.ok).toBe(false);
    expect(performance.now() - t).toBeLessThan(50);
  });

  it('clamps out-of-range channels instead of throwing', () => {
    expect(toHex(rgb('rgb(300 -5 0)'))).toBe('#ff0000');
  });
});

describe('contrast', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrast(rgb('#000'), rgb('#fff'))).toBeCloseTo(21, 5);
    expect(contrast(rgb('#abc'), rgb('#abc'))).toBeCloseTo(1, 5);
  });
  it('matches the well-known #767676 / #777 boundary', () => {
    expect(contrast(rgb('#767676'), rgb('#fff'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(rgb('#777777'), rgb('#fff'))).toBeLessThan(4.5);
  });
  it('is symmetric', () => {
    expect(contrast(rgb('#e8590c'), rgb('#fff'))).toBeCloseTo(
      contrast(rgb('#fff'), rgb('#e8590c')),
      10,
    );
  });
});

describe('OKLCH', () => {
  it('round-trips 8-bit colours exactly', () => {
    for (const hex of [
      '#1a73e8',
      '#e8590c',
      '#00ff00',
      '#808080',
      '#000000',
      '#ffffff',
      '#12ab34',
    ]) {
      expect(toHex(oklchToRgb(rgbToOklch(rgb(hex))))).toBe(hex);
    }
  });
  it('puts white at L=1 and black at L=0', () => {
    expect(rgbToOklch(rgb('#fff')).l).toBeCloseTo(1, 3);
    expect(rgbToOklch(rgb('#000')).l).toBeCloseTo(0, 3);
  });
  it('maps out-of-gamut colours in without rotating hue', () => {
    const out = rgbToOklch(oklchToRgb({ l: 0.9, c: 0.35, h: 200 }));
    expect(hueDelta(out.h, 200)).toBeLessThan(6);
  });
  it('hueDelta wraps', () => {
    expect(hueDelta(359, 1)).toBe(2);
  });
});

describe('parser strictness (QA M2, padded input)', () => {
  it('rejects odd hue notations', () => {
    expect(parseColor('hsl(0x10 100% 50%)').ok).toBe(false);
    expect(parseColor('hsl(1e3 100% 50%)').ok).toBe(false);
  });
  it('accepts padded valid input past the raw length limit', () => {
    expect(parseColor(' '.repeat(100) + '#fff').ok).toBe(true);
  });
});

describe('formatRatio', () => {
  it('rounds normally: #777 on white reads 4.48 as the spec says', () => {
    expect(formatRatio(contrast([119, 119, 119], [255, 255, 255]))).toBe('4.48');
    expect(formatRatio(21)).toBe('21.00');
  });
  it('never rounds a failing ratio up to the threshold', () => {
    expect(formatRatio(4.4954)).toBe('4.49');
    expect(formatRatio(2.996)).toBe('2.99');
    expect(formatRatio(6.999)).toBe('6.99');
    expect(formatRatio(4.5)).toBe('4.50');
  });
});
