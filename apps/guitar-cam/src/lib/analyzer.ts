import { chordFromChroma, chromagram, type Chord } from './chord';
import { detectPitch, rms } from './pitch';
import { describeFrequency, type Pitch } from './music';

export type Reading =
  | { kind: 'silence' }
  | { kind: 'note'; pitch: Pitch; frequency: number; clarity: number }
  | { kind: 'chord'; chord: Chord }
  /** Sound is present but fits neither a single note nor a known chord. */
  | { kind: 'unclear' };

/** Samples the analyser needs: enough for the chroma, whose FFT is the longest window. */
export const WINDOW = 16384;
/** The pitch detector looks at the most recent slice only, to stay responsive. */
const PITCH_WINDOW = 4096;

/** Below this RMS the guitar is not sounding (≈ −46 dBFS). */
export const GATE = 0.005;
/** A signal this periodic is one string. */
const NOTE_CLARITY = 0.95;
/** Below this, nothing periodic enough to call a note even when no chord fits. */
const WEAK_NOTE_CLARITY = 0.85;
/** A pitch class this close to the strongest counts as a note someone played. */
const STRONG_VOICE = 0.5;

/** A chord must keep the same harmonic content for this long before it is believed. */
const SUSTAIN_MS = 200;
const SUSTAIN_SIMILARITY = 0.92;
const HISTORY_MS = 700;

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] as number) * (b[i] as number);
    na += (a[i] as number) ** 2;
    nb += (b[i] as number) ** 2;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

export type Analyzer = (samples: Float32Array, sampleRate: number, nowMs: number) => Reading;

/**
 * Stateful, because one question cannot be answered from one frame: the chroma window is
 * long enough to resolve low strings, so right after a melody changes note it holds both
 * the old note and the new one, and that blend looks exactly like a chord. A chord is only
 * believed once its chroma has stopped changing.
 */
export function createAnalyzer(): Analyzer {
  let history: Array<{ t: number; chroma: Float32Array }> = [];
  let holding: string | null = null;

  return (samples, sampleRate, nowMs) => {
    const recent = samples.subarray(Math.max(0, samples.length - PITCH_WINDOW));
    if (rms(recent) < GATE) {
      history = [];
      holding = null;
      return { kind: 'silence' };
    }

    const pitch = detectPitch(recent, sampleRate);
    const clearNote = pitch !== null && pitch.clarity >= NOTE_CLARITY;
    // The slice before it. A melody moves between two clear, different notes; a chord does not.
    const older = samples.subarray(
      Math.max(0, samples.length - 2 * PITCH_WINDOW),
      Math.max(0, samples.length - PITCH_WINDOW),
    );
    const before = older.length === PITCH_WINDOW ? detectPitch(older, sampleRate) : null;
    const melodic =
      clearNote &&
      before !== null &&
      before.clarity >= NOTE_CLARITY &&
      describeFrequency(before.frequency).midi !== describeFrequency(pitch.frequency).midi;

    let chord: Chord | null = null;
    let voices = 0;
    let sustained = false;
    if (samples.length >= WINDOW) {
      const chroma = chromagram(samples.subarray(samples.length - WINDOW), sampleRate);
      chord = chordFromChroma(chroma);
      // A single string's overtones put a little energy on its fifth and third; a chord puts
      // as much there as on the root. Count the pitch classes that are genuinely sounding.
      const top = Math.max(...chroma);
      voices = chroma.filter((v) => v >= top * STRONG_VOICE).length;
      const then = [...history].reverse().find((h) => nowMs - h.t >= SUSTAIN_MS);
      sustained = then !== undefined && cosine(chroma, then.chroma) >= SUSTAIN_SIMILARITY;
      history = [...history.filter((h) => nowMs - h.t <= HISTORY_MS), { t: nowMs, chroma }];
    }

    if (melodic && pitch) {
      holding = null;
      return note(pitch.frequency, pitch.clarity);
    }
    // A chord is believed once steady, and then kept for as long as it is still the best fit:
    // the strings decay at different rates, so its chroma drifts after it has been named.
    // Once named, it only has to stay audible: as strings die away they drop out of the count.
    if (chord && ((sustained && voices >= 3) || (chord.name === holding && voices >= 2))) {
      holding = chord.name;
      return { kind: 'chord', chord };
    }
    holding = null;
    // Three or more pitch classes are building up but are not yet steady: wait, rather than
    // report the virtual fundamental of a stacked chord (a D chord "sounds" like a low D).
    if (chord && voices >= 3) return { kind: 'unclear' };
    if (pitch && clearNote) return note(pitch.frequency, pitch.clarity);
    if (pitch && pitch.clarity >= WEAK_NOTE_CLARITY)
      return note(pitch.frequency, pitch.clarity);
    return { kind: 'unclear' };
  };
}

function note(frequency: number, clarity: number): Reading {
  return { kind: 'note', pitch: describeFrequency(frequency), frequency, clarity };
}
