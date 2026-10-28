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

export function analyze(samples: Float32Array, sampleRate: number): Reading {
  const recent = samples.subarray(Math.max(0, samples.length - PITCH_WINDOW));
  if (rms(recent) < GATE) return { kind: 'silence' };

  const pitch = detectPitch(recent, sampleRate);
  const clearNote = pitch !== null && pitch.clarity >= NOTE_CLARITY;

  let chord: Chord | null = null;
  let voices = 0;
  if (samples.length >= WINDOW) {
    const chroma = chromagram(samples.subarray(samples.length - WINDOW), sampleRate);
    chord = chordFromChroma(chroma);
    // A single string's overtones put a little energy on its fifth and third; a chord puts
    // as much there as on the root. Count the pitch classes that are genuinely sounding.
    const top = Math.max(...chroma);
    voices = chroma.filter((v) => v >= top * STRONG_VOICE).length;
  }

  // Stacked chord tones can be nearly periodic (a D chord is close to one harmonic series),
  // so a clean period alone does not prove a single string.
  if (chord && voices >= 3) return { kind: 'chord', chord };
  if (pitch && clearNote) return note(pitch.frequency, pitch.clarity);
  if (chord) return { kind: 'chord', chord };
  if (pitch && pitch.clarity >= WEAK_NOTE_CLARITY) return note(pitch.frequency, pitch.clarity);
  return { kind: 'unclear' };
}

function note(frequency: number, clarity: number): Reading {
  return { kind: 'note', pitch: describeFrequency(frequency), frequency, clarity };
}
