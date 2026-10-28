import type { Chord } from './chord';
import type { Reading } from './analyzer';
import type { RawEvent } from './take';

/** Consecutive agreeing frames before a new note or chord is believed. */
export const CONFIRM_FRAMES = 3;
/** How long the sound may vanish before the event is closed (plucks flicker). */
export const RELEASE_MS = 160;
/** Anything shorter is a click or a ghost note, not something played. */
export const MIN_EVENT_MS = 90;

type Key = string;

interface Active {
  key: Key;
  reading: Reading;
  t0: number;
  lastSeen: number;
}

export interface Held {
  reading: Reading;
  t0: number;
}

function keyOf(r: Reading): Key | null {
  if (r.kind === 'note') return `n${r.pitch.midi}`;
  if (r.kind === 'chord') return `c${r.chord.name}`;
  return null;
}

function toRaw(a: Active, t1: number): RawEvent | null {
  if (t1 - a.t0 < MIN_EVENT_MS) return null;
  if (a.reading.kind === 'note') {
    return { kind: 'note', t0: a.t0, t1, midi: a.reading.pitch.midi };
  }
  if (a.reading.kind === 'chord') {
    const chord: Chord = a.reading.chord;
    return { kind: 'chord', t0: a.t0, t1, chord };
  }
  return null;
}

/**
 * Turns the analyser's frame-by-frame readings into discrete played events. A frame is
 * a vote; an event opens when enough consecutive votes agree and closes once the sound
 * has gone, or has settled on something else.
 */
export class Tracker {
  private active: Active | null = null;
  private pending: { key: Key; count: number; t0: number; reading: Reading } | null = null;

  /** What is sounding now, once believed. */
  get held(): Held | null {
    return this.active ? { reading: this.active.reading, t0: this.active.t0 } : null;
  }

  push(t: number, reading: Reading): RawEvent[] {
    const done: RawEvent[] = [];
    const key = keyOf(reading);

    if (key !== null && this.active && key === this.active.key) {
      this.active.lastSeen = t;
      this.active.reading = reading;
      this.pending = null;
      return done;
    }

    if (key === null) {
      this.pending = null;
      if (this.active && t - this.active.lastSeen >= RELEASE_MS) {
        const raw = toRaw(this.active, this.active.lastSeen);
        if (raw) done.push(raw);
        this.active = null;
      }
      return done;
    }

    this.pending =
      this.pending && this.pending.key === key
        ? { ...this.pending, count: this.pending.count + 1, reading }
        : { key, count: 1, t0: t, reading };

    if (this.pending.count >= CONFIRM_FRAMES) {
      if (this.active) {
        const raw = toRaw(this.active, this.pending.t0);
        if (raw) done.push(raw);
      }
      this.active = { key, reading, t0: this.pending.t0, lastSeen: t };
      this.pending = null;
    }
    return done;
  }

  /** Close whatever is open, e.g. when recording stops. */
  flush(t: number): RawEvent[] {
    const raw = this.active ? toRaw(this.active, Math.max(t, this.active.lastSeen)) : null;
    this.active = null;
    this.pending = null;
    return raw ? [raw] : [];
  }
}
