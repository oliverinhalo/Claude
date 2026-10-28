import { describe, expect, it } from 'vitest';
import { WINDOW, createAnalyzer, type Reading } from './analyzer';
import { noise, pluck, strum } from './synth';

const SHAPES: Record<string, number[]> = {
  E: [40, 47, 52, 56, 59, 64],
  Em: [40, 47, 52, 55, 59, 64],
  A: [45, 52, 57, 61, 64],
  Am: [45, 52, 57, 60, 64],
  D: [50, 57, 62, 66],
  Dm: [50, 57, 62, 65],
  G: [43, 47, 50, 55, 59, 67],
  C: [48, 52, 55, 60, 64],
  E7: [40, 47, 50, 56, 59, 64],
  A7: [45, 52, 55, 61, 64],
  D7: [50, 57, 60, 66],
};

/** What the analyser says about a sound that has been held steady for a while. */
function analyze(samples: Float32Array, sr: number): Reading {
  const a = createAnalyzer();
  a(samples, sr, 0);
  return a(samples, sr, 200);
}

for (const sr of [44100, 48000]) {
  describe(`analyze @ ${sr} Hz`, () => {
    for (const midi of [40, 45, 50, 55, 59, 64, 52, 67, 71, 76, 83]) {
      it(`hears a single string, MIDI ${midi}, as that note`, () => {
        const r = analyze(pluck(midi, sr, WINDOW, 4000), sr);
        expect(r.kind).toBe('note');
        if (r.kind === 'note') {
          expect(r.pitch.midi).toBe(midi);
          expect(Math.abs(r.pitch.cents)).toBeLessThanOrEqual(3);
        }
      });
    }
    for (const [name, midis] of Object.entries(SHAPES)) {
      it(`hears a strummed ${name} as a chord`, () => {
        const r = analyze(strum(midis, sr, WINDOW, 4000), sr);
        expect(r.kind).toBe('chord');
        if (r.kind === 'chord') expect(r.chord.name).toBe(name);
      });
    }
    it('hears nothing in silence', () => {
      expect(analyze(new Float32Array(WINDOW), sr).kind).toBe('silence');
    });
    it('does not invent a note or chord from noise', () => {
      const r = analyze(noise(WINDOW, 0.1), sr);
      expect(['unclear', 'chord']).toContain(r.kind);
      expect(r.kind === 'note').toBe(false);
    });
  });
}
