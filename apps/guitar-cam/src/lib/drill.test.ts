import { describe, expect, it } from 'vitest';
import { describeMiss, judge, pickTarget } from './drill';
import { DEFAULT_TUNING, tuningById } from './music';

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('pickTarget', () => {
  it('words the prompt as a note on a named string', () => {
    // string index 4 of 6 → "B" in standard; fret 8 → G.
    const rng = [4.5 / 6, 8.5 / 13].values();
    const t = pickTarget(DEFAULT_TUNING, null, () => rng.next().value as number);
    expect(t.position).toEqual({ string: 5, fret: 8 });
    expect(t.prompt).toBe('F on the A string');
  });
  it('stays within twelve frets and does not repeat the last spot', () => {
    const rng = seeded(7);
    let prev = pickTarget(DEFAULT_TUNING, null, rng);
    for (let i = 0; i < 300; i++) {
      const next = pickTarget(DEFAULT_TUNING, prev, rng);
      expect(next.position.fret).toBeLessThanOrEqual(12);
      expect(next.position).not.toEqual(prev.position);
      prev = next;
    }
  });
  it('names strings by their open note in other tunings', () => {
    const t = pickTarget(tuningById('drop-d'), null, () => 0.99);
    expect(t.prompt).toMatch(/on the D string$/);
  });
});

describe('judge', () => {
  const target = pickTarget(DEFAULT_TUNING, null, seeded(3));
  it('accepts the target pitch', () => {
    expect(judge(target.midi, target)).toEqual({ kind: 'correct' });
  });
  it('says how far off a miss was, and in which direction', () => {
    const v = judge(target.midi + 1, target);
    expect(v.kind).toBe('wrong');
    if (v.kind === 'wrong') expect(describeMiss(v)).toMatch(/1 semitone above the target/);
    const w = judge(target.midi - 2, target);
    if (w.kind === 'wrong') expect(describeMiss(w)).toMatch(/2 semitones below the target/);
  });
});
