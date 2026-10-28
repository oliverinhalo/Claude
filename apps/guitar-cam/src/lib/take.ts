import { MAX_FRET, TUNINGS, noteName, pitchAt, type FretPosition, type Tuning } from './music';
import { voicingFor, type Chord } from './chord';
import { choosePosition } from './music';

/** One thing played: a note or a chord, as the fingers would read it on tab. */
export interface TabEvent {
  /** Milliseconds from the start of the take. */
  t0: number;
  t1: number;
  /** "E♯3"-style note or chord name, for display. */
  label: string;
  notes: FretPosition[];
  /** True when the fingering was inferred from the audio rather than heard. */
  inferred: boolean;
}

export interface Take {
  id: string;
  createdAt: string;
  tuning: string;
  events: TabEvent[];
}

export type RawEvent =
  | { kind: 'note'; t0: number; t1: number; midi: number }
  | { kind: 'chord'; t0: number; t1: number; chord: Chord };

/** Last-played position, for keeping a melody in one place on the neck. */
export function lastPosition(events: readonly TabEvent[]): FretPosition | null {
  const last = events[events.length - 1];
  return last?.notes.length === 1 ? (last.notes[0] ?? null) : null;
}

export function toTabEvent(
  raw: RawEvent,
  tuning: Tuning,
  previous: FretPosition | null,
): TabEvent | null {
  if (raw.kind === 'note') {
    const position = choosePosition(raw.midi, tuning, previous);
    if (!position) return null;
    const label = `${noteName(raw.midi)}${Math.floor(raw.midi / 12) - 1}`;
    return { t0: raw.t0, t1: raw.t1, label, notes: [position], inferred: true };
  }
  const frets = voicingFor(raw.chord, tuning);
  if (!frets) return null;
  const notes = frets.flatMap((fret, i) => (fret === null ? [] : [{ string: 6 - i, fret }]));
  return { t0: raw.t0, t1: raw.t1, label: raw.chord.name, notes, inferred: true };
}

/** The pitches a tab event sounds, lowest string first. */
export const eventPitches = (event: TabEvent, tuning: Tuning): number[] =>
  [...event.notes].sort((a, b) => b.string - a.string).map((p) => pitchAt(p, tuning));

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;
const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isTime = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

function isEvent(v: unknown): v is TabEvent {
  return (
    isObject(v) &&
    isTime(v.t0) &&
    isTime(v.t1) &&
    v.t1 >= v.t0 &&
    typeof v.label === 'string' &&
    v.label.length <= 16 &&
    typeof v.inferred === 'boolean' &&
    Array.isArray(v.notes) &&
    v.notes.length >= 1 &&
    v.notes.length <= 6 &&
    v.notes.every((n) => isObject(n) && isInt(n.string, 1, 6) && isInt(n.fret, 0, MAX_FRET))
  );
}

export function isTake(v: unknown): v is Take {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.createdAt === 'string' &&
    typeof v.tuning === 'string' &&
    TUNINGS.some((t) => t.id === v.tuning) &&
    Array.isArray(v.events) &&
    v.events.length <= 5000 &&
    v.events.every(isEvent)
  );
}

export function parseTake(json: string): Take | null {
  try {
    const parsed: unknown = JSON.parse(json);
    return isTake(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
