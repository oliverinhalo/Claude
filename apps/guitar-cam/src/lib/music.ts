/** Pitch arithmetic and the guitar's geometry. Pure; no DOM. */

export const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;
export const MAX_FRET = 24;

export interface Tuning {
  id: string;
  name: string;
  /** MIDI note per open string, string 6 (lowest) first. */
  strings: readonly [number, number, number, number, number, number];
}

export const TUNINGS: readonly Tuning[] = [
  { id: 'standard', name: 'Standard  E A D G B E', strings: [40, 45, 50, 55, 59, 64] },
  { id: 'drop-d', name: 'Drop D  D A D G B E', strings: [38, 45, 50, 55, 59, 64] },
  {
    id: 'half-down',
    name: 'Half step down  E♭ A♭ D♭ G♭ B♭ E♭',
    strings: [39, 44, 49, 54, 58, 63],
  },
  { id: 'dadgad', name: 'DADGAD', strings: [38, 45, 50, 55, 57, 62] },
  { id: 'open-g', name: 'Open G  D G D G B D', strings: [38, 43, 50, 55, 59, 62] },
];

export const DEFAULT_TUNING = TUNINGS[0] as Tuning;

export function tuningById(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? DEFAULT_TUNING;
}

export const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/** Fractional MIDI number for a frequency. */
export const freqToMidi = (freq: number): number => 69 + 12 * Math.log2(freq / 440);

export const pitchClass = (midi: number): number => ((Math.round(midi) % 12) + 12) % 12;

export const noteName = (midi: number): string => NOTE_NAMES[pitchClass(midi)] as string;

/** Scientific pitch notation: E2, F♯3. Middle C is C4 (MIDI 60). */
export const noteWithOctave = (midi: number): string =>
  `${noteName(midi)}${Math.floor(Math.round(midi) / 12) - 1}`;

export interface Pitch {
  midi: number;
  /** Signed offset from the nearest equal-tempered note, in cents (−50…50). */
  cents: number;
}

export function describeFrequency(freq: number): Pitch {
  const exact = freqToMidi(freq);
  const midi = Math.round(exact);
  return { midi, cents: Math.round((exact - midi) * 100) };
}

export interface FretPosition {
  /** 1 = high e, 6 = low E, as on a tab. */
  string: number;
  fret: number;
}

/** Every place a pitch can be played. Higher strings first, as tab reads. */
export function positionsFor(midi: number, tuning: Tuning, maxFret = MAX_FRET): FretPosition[] {
  const out: FretPosition[] = [];
  for (let s = 5; s >= 0; s--) {
    const fret = midi - (tuning.strings[s] as number);
    if (fret >= 0 && fret <= maxFret) out.push({ string: 6 - s, fret });
  }
  return out;
}

/** The pitch at a string and fret. */
export function pitchAt(position: FretPosition, tuning: Tuning): number {
  return (tuning.strings[6 - position.string] as number) + position.fret;
}

/**
 * Pick the position that moves the hand least from where it was, falling back to the
 * lowest fret. Keeps a transcribed melody in one place on the neck.
 */
export function choosePosition(
  midi: number,
  tuning: Tuning,
  previous: FretPosition | null,
): FretPosition | null {
  const options = positionsFor(midi, tuning);
  if (options.length === 0) return null;
  const cost = (p: FretPosition): number =>
    previous
      ? Math.abs(p.fret - previous.fret) + 0.5 * Math.abs(p.string - previous.string)
      : // No history: prefer the first five frets, then the lowest.
        p.fret <= 5
        ? p.fret
        : 10 + p.fret;
  return options.reduce((best, p) => (cost(p) < cost(best) ? p : best));
}

/** Playable range of the instrument in this tuning. */
export function range(tuning: Tuning): { low: number; high: number } {
  return {
    low: Math.min(...tuning.strings),
    high: Math.max(...tuning.strings) + MAX_FRET,
  };
}
