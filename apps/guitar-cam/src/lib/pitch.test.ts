import { must } from '../test-helpers';
import { describe, expect, it } from 'vitest';
import { detectPitch } from './pitch';
import { noise, pluck } from './synth';
import { TUNINGS, describeFrequency, midiToFreq } from './music';

const SR = 44100;
const N = 4096;

describe('detectPitch', () => {
  for (const midi of must(TUNINGS[0]).strings) {
    it(`finds open string MIDI ${midi} within 3 cents`, () => {
      const r = detectPitch(pluck(midi, SR, N, 2000), SR);
      expect(r).not.toBeNull();
      const cents = 1200 * Math.log2(must(r).frequency / midiToFreq(midi));
      expect(Math.abs(cents)).toBeLessThan(3);
      expect(must(r).clarity).toBeGreaterThan(0.9);
    });
  }

  it('reports a flat note as flat', () => {
    const flat = pluck(52, SR, N, 0).map((_, i) =>
      Math.sin(2 * Math.PI * midiToFreq(52 - 0.3) * (i / SR)),
    );
    const r = must(detectPitch(flat, SR));
    expect(describeFrequency(r.frequency)).toEqual({ midi: 52, cents: -30 });
  });

  it('returns null for silence', () => {
    expect(detectPitch(new Float32Array(N), SR)).toBeNull();
  });

  it('returns null or low clarity for noise', () => {
    const r = detectPitch(noise(N), SR);
    expect(r === null || r.clarity < 0.8).toBe(true);
  });
});
