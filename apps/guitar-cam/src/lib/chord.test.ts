import { must } from '../test-helpers';
import { describe, expect, it } from 'vitest';
import { chordPositions, identifyChord, voicingFor } from './chord';
import { strum } from './synth';
import { DEFAULT_TUNING, pitchAt } from './music';

const SR = 44100;
const N = 16384;

// Open-position shapes, low string first, as MIDI notes.
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

describe('identifyChord', () => {
  for (const [name, midis] of Object.entries(SHAPES)) {
    it(`names a strummed ${name}`, () => {
      const chord = identifyChord(strum(midis, SR, N, 3000), SR);
      expect(chord?.name).toBe(name);
    });
  }

  it('does not name silence', () => {
    expect(identifyChord(new Float32Array(N), SR)).toBeNull();
  });
});

describe('voicingFor', () => {
  it('finds a playable voicing that spells the chord with the root in the bass', () => {
    for (const name of ['E', 'Am', 'G', 'C', 'D7']) {
      const chord = must(identifyChord(strum(must(SHAPES[name]), SR, N, 3000), SR));
      const frets = must(voicingFor(chord, DEFAULT_TUNING));
      expect(frets, name).not.toBeNull();
      const notes = frets.flatMap((f, i) =>
        f === null ? [] : [pitchAt({ string: 6 - i, fret: f }, DEFAULT_TUNING)],
      );
      expect(notes.length).toBeGreaterThanOrEqual(4);
      expect(new Set(notes.map((n) => n % 12))).toEqual(new Set(chord.tones));
      expect(must(notes[0]) % 12).toBe(chord.root);
    }
  });
});

describe('chordPositions', () => {
  it('only lists positions whose pitch class is in the chord', () => {
    const chord = must(identifyChord(strum(must(SHAPES.G), SR, N, 3000), SR));
    for (const p of chordPositions(chord, DEFAULT_TUNING)) {
      expect(chord.tones).toContain(pitchAt(p, DEFAULT_TUNING) % 12);
    }
  });
});
