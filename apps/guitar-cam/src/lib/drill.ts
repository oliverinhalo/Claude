import { noteName, pitchAt, type FretPosition, type Tuning } from './music';

export interface Target {
  position: FretPosition;
  midi: number;
  /** "G on the B string" */
  prompt: string;
}

const STRING_NAMES = ['', 'high E', 'B', 'G', 'D', 'A', 'low E'];

export const stringName = (string: number, tuning: Tuning): string =>
  tuning.id === 'standard'
    ? (STRING_NAMES[string] as string)
    : noteName(tuning.strings[6 - string] as number);

/**
 * A random spot within the first twelve frets. Never the same spot twice running, and
 * never an open string more than a third of the time, so it is a fretboard test and not
 * a tuning exercise.
 */
export function pickTarget(
  tuning: Tuning,
  previous: Target | null,
  random: () => number = Math.random,
  maxFret = 12,
): Target {
  for (;;) {
    const string = 1 + Math.floor(random() * 6);
    const fret = Math.floor(random() * (maxFret + 1));
    if (fret === 0 && random() > 0.33) continue;
    if (previous && previous.position.string === string && previous.position.fret === fret) {
      continue;
    }
    const position = { string, fret };
    const midi = pitchAt(position, tuning);
    return {
      position,
      midi,
      prompt: `${noteName(midi)} on the ${stringName(string, tuning)} string`,
    };
  }
}

export type Verdict =
  { kind: 'correct' } | { kind: 'wrong'; semitones: number; played: string };

/** Compare what was played with the target. Pitch is what a microphone can know. */
export function judge(playedMidi: number, target: Target): Verdict {
  if (playedMidi === target.midi) return { kind: 'correct' };
  return { kind: 'wrong', semitones: playedMidi - target.midi, played: noteName(playedMidi) };
}

export function describeMiss(v: Extract<Verdict, { kind: 'wrong' }>): string {
  const n = Math.abs(v.semitones);
  const unit = n === 1 ? 'semitone' : 'semitones';
  return `That was ${v.played}, ${n} ${unit} ${v.semitones > 0 ? 'above' : 'below'} the target.`;
}
