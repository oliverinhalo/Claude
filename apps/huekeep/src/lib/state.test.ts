import { beforeEach, describe, expect, it } from 'vitest';
import { SEED, fromHash, isState, store, toHash } from './state';
import { contrast, parseColor, type RGB } from './color';
import { solve } from './fix';

const rgb = (s: string): RGB => {
  const r = parseColor(s);
  if (!r.ok) throw new Error(r.reason);
  return r.rgb;
};

beforeEach(() => localStorage.clear());

describe('seed', () => {
  it('fails AA but has a fix that passes (first-run promise)', () => {
    expect(contrast(rgb(SEED.fg), rgb(SEED.bg))).toBeLessThan(4.5);
    const o = solve(rgb(SEED.fg), rgb(SEED.bg), SEED.target);
    expect(o.status).toBe('fixable');
  });
});

describe('share hash', () => {
  it('round-trips awkward values', () => {
    const s = { fg: 'rgb(26 115 232)', bg: '#fff', target: 7 as const };
    expect(fromHash(toHash(s))).toEqual(s);
  });
  it.each([
    '',
    '#',
    '#fg=a',
    '#fg=a&bg=b&t=5',
    '#' + 'x'.repeat(400),
    '#fg=' + 'a'.repeat(100) + '&bg=b',
    '#fg=banana&bg=%23fff', // colours that do not parse
    '#fg=%23fff&bg=%3Cscript%3E&t=4.5',
    '#fg=%23fff&bg=%23000&t=0x7', // not a plain number
    '#fg=%23fff&bg=%23000&t=%207',
  ])('ignores malformed hash %#', (h) => expect(fromHash(h)).toBeNull());
});

describe('store', () => {
  it('recovers from garbage and wrong shapes', () => {
    localStorage.setItem('huekeep:state', 'garbage');
    expect(store.load().status).toBe('recovered');
    localStorage.setItem(
      'huekeep:state',
      JSON.stringify({ v: 1, d: { fg: 1, bg: 2, target: 9 } }),
    );
    expect(store.load().value).toEqual(SEED);
  });
  it('validates', () => {
    expect(isState(SEED)).toBe(true);
    expect(isState({ ...SEED, target: 5 })).toBe(false);
  });
});

describe('malformed hash (QA F5)', () => {
  it('rejects broken percent-encoding', () => {
    expect(fromHash('#fg=%E0%A4%A&bg=x')).toBeNull();
  });
});
