import { magnitudeSpectrum } from './fft';
import {
  MAX_FRET,
  NOTE_NAMES,
  freqToMidi,
  midiToFreq,
  pitchClass,
  type FretPosition,
  type Tuning,
} from './music';

export interface ChordQuality {
  id: string;
  suffix: string;
  /** Semitones above the root. */
  tones: readonly number[];
}

export const QUALITIES: readonly ChordQuality[] = [
  { id: 'maj', suffix: '', tones: [0, 4, 7] },
  { id: 'min', suffix: 'm', tones: [0, 3, 7] },
  { id: '7', suffix: '7', tones: [0, 4, 7, 10] },
  { id: 'maj7', suffix: 'maj7', tones: [0, 4, 7, 11] },
  { id: 'm7', suffix: 'm7', tones: [0, 3, 7, 10] },
  { id: 'sus2', suffix: 'sus2', tones: [0, 2, 7] },
  { id: 'sus4', suffix: 'sus4', tones: [0, 5, 7] },
  { id: 'dim', suffix: 'dim', tones: [0, 3, 6] },
];

export interface Chord {
  root: number;
  quality: ChordQuality;
  name: string;
  /** Pitch classes in the chord. */
  tones: number[];
  /** 0–1: how well the audio fits the chord. */
  confidence: number;
}

const LOW = 75;
const HIGH = 1600;

/**
 * Fold a spectrum into 12 pitch classes. Only spectral peaks count, each credited to the
 * semitone it sits on and weighted by its (square-rooted) magnitude, so a loud note does
 * not drown a quiet one. Frequencies below the guitar's range are ignored.
 */
export function chromagram(samples: Float32Array, sampleRate: number): Float32Array {
  const spectrum = magnitudeSpectrum(samples);
  const binHz = sampleRate / samples.length;
  const chroma = new Float32Array(12);
  const first = Math.max(2, Math.floor(LOW / binHz));
  const last = Math.min(spectrum.length - 2, Math.ceil(HIGH / binHz));
  let top = 0;
  for (let i = first; i <= last; i++) top = Math.max(top, spectrum[i] as number);
  if (top === 0) return chroma;
  for (let i = first; i <= last; i++) {
    const m = spectrum[i] as number;
    if (m < top * 0.02 || m < (spectrum[i - 1] as number) || m < (spectrum[i + 1] as number))
      continue;
    // Refine the peak position between bins.
    const a = spectrum[i - 1] as number;
    const c = spectrum[i + 1] as number;
    const denom = a - 2 * m + c;
    const freq = (i + (denom === 0 ? 0 : (0.5 * (a - c)) / denom)) * binHz;
    const midi = freqToMidi(freq);
    const nearest = Math.round(midi);
    if (Math.abs(midi - nearest) > 0.25) continue; // between semitones: not a note
    const pc = pitchClass(nearest);
    chroma[pc] = (chroma[pc] as number) + Math.sqrt(m / top);
  }
  return chroma;
}

/** How strongly each pitch class is supported, once harmonics are accounted for. */
function explainHarmonics(chroma: Float32Array): Float32Array {
  // Each note puts energy on its octave, fifth, and major third above as overtones.
  // Take a fraction of that away from the pitch classes those overtones land on, so the
  // fifth of an E does not look like a B someone played.
  const out = Float32Array.from(chroma);
  for (let pc = 0; pc < 12; pc++) {
    const e = chroma[pc] as number;
    out[(pc + 7) % 12] = (out[(pc + 7) % 12] as number) - 0.35 * e;
    out[(pc + 4) % 12] = (out[(pc + 4) % 12] as number) - 0.12 * e;
  }
  return out.map((v) => Math.max(0, v));
}

export function chordName(root: number, quality: ChordQuality): string {
  return `${NOTE_NAMES[root]}${quality.suffix}`;
}

export function identifyChord(samples: Float32Array, sampleRate: number): Chord | null {
  return chordFromChroma(chromagram(samples, sampleRate));
}

export function chordFromChroma(raw: Float32Array): Chord | null {
  const chroma = explainHarmonics(raw);
  const total = chroma.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let best: { root: number; quality: ChordQuality; score: number } | null = null;
  for (let root = 0; root < 12; root++) {
    for (const quality of QUALITIES) {
      const members = new Set(quality.tones.map((t) => (root + t) % 12));
      let inside = 0;
      let outside = 0;
      let missing = 0;
      for (let pc = 0; pc < 12; pc++) {
        const v = chroma[pc] as number;
        if (members.has(pc)) {
          inside += v;
          if (v < total * 0.06) missing += 1;
        } else {
          outside += v;
        }
      }
      // Reward explained energy, punish stray notes and absent chord tones, and favour
      // the simpler chord when two fit equally well.
      const explained = inside / total;
      const rootBonus = (chroma[root] as number) / total;
      const score =
        explained -
        outside / total -
        0.25 * missing +
        0.15 * rootBonus -
        0.1 * (quality.tones.length - 3);
      if (!best || score > best.score) best = { root, quality, score };
    }
  }
  if (!best || best.score < 0.45) return null;
  return {
    root: best.root,
    quality: best.quality,
    name: chordName(best.root, best.quality),
    tones: best.quality.tones.map((t) => (best.root + t) % 12),
    confidence: Math.min(1, best.score),
  };
}

/**
 * A playable voicing for a chord: one fret per string (or muted), inside a four-fret
 * window, root in the bass, as low on the neck as possible. Inferred, not heard.
 */
export function voicingFor(chord: Chord, tuning: Tuning): (number | null)[] | null {
  const members = new Set(chord.tones);
  let best: { frets: (number | null)[]; score: number } | null = null;
  for (let window = 0; window <= MAX_FRET - 3; window++) {
    const lo = window === 0 ? 0 : window;
    const hi = window + 3;
    const frets: (number | null)[] = [];
    // Highest fret first would be a guess; instead take, per string, the lowest fret in
    // the window that carries a chord tone, or mute it.
    for (let s = 0; s < 6; s++) {
      let found: number | null = null;
      for (let f = lo === 0 ? 0 : lo; f <= hi; f++) {
        if (members.has(pitchClass((tuning.strings[s] as number) + f))) {
          found = f;
          break;
        }
      }
      // Open strings sit outside any window above the nut: allow them when they fit.
      if (found === null || (window > 0 && found > hi)) found = null;
      if (
        window > 0 &&
        found === null &&
        members.has(pitchClass(tuning.strings[s] as number))
      ) {
        found = 0;
      }
      frets.push(found);
    }
    // Mute any low strings until the bass is the root.
    for (let s = 0; s < 6; s++) {
      const f = frets[s];
      if (f === null || f === undefined) continue;
      if (pitchClass((tuning.strings[s] as number) + f) === chord.root) break;
      frets[s] = null;
    }
    const sounding = frets.filter((f) => f !== null).length;
    if (sounding < Math.min(4, chord.tones.length + 1)) continue;
    const covered = new Set(
      frets.flatMap((f, s) =>
        f === null ? [] : [pitchClass((tuning.strings[s] as number) + f)],
      ),
    );
    if (!chord.tones.every((t) => covered.has(t))) continue;
    const fretted = frets.filter((f): f is number => f !== null && f > 0);
    const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
    const score = window * 2 + span * 3 + (6 - sounding);
    if (!best || score < best.score) best = { frets, score };
    if (window === 0 && best) break;
  }
  return best ? best.frets : null;
}

/** Every position on the neck that carries a chord tone, for lighting the fretboard. */
export function chordPositions(chord: Chord, tuning: Tuning, maxFret = 15): FretPosition[] {
  const out: FretPosition[] = [];
  const members = new Set(chord.tones);
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= maxFret; f++) {
      if (members.has(pitchClass((tuning.strings[s] as number) + f))) {
        out.push({ string: 6 - s, fret: f });
      }
    }
  }
  return out;
}

/** Frequency of a chord's root, in the octave nearest the guitar's low strings. */
export const rootFrequency = (root: number): number => midiToFreq(36 + root);
