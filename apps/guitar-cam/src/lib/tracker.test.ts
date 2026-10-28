import { describe, expect, it } from 'vitest';
import { Tracker } from './tracker';
import type { Reading } from './analyzer';

const note = (midi: number): Reading => ({
  kind: 'note',
  pitch: { midi, cents: 0 },
  frequency: 440,
  clarity: 0.99,
});
const silence: Reading = { kind: 'silence' };

/** Feed `ms` of the same reading at 20 ms frames. */
function feed(tr: Tracker, from: number, ms: number, r: Reading) {
  const out = [];
  for (let t = from; t < from + ms; t += 20) out.push(...tr.push(t, r));
  return out;
}

describe('Tracker', () => {
  it('opens a note only after it is stable, and dates it from its first frame', () => {
    const tr = new Tracker();
    expect(tr.push(0, note(40))).toEqual([]);
    expect(tr.held).toBeNull();
    tr.push(20, note(40));
    tr.push(40, note(40));
    expect(tr.held?.t0).toBe(0);
  });
  it('ignores a one-frame glitch', () => {
    const tr = new Tracker();
    feed(tr, 0, 400, note(40));
    tr.push(400, note(52));
    feed(tr, 420, 200, note(40));
    expect(tr.held?.reading).toMatchObject({ pitch: { midi: 40 } });
    expect(tr.flush(700)).toHaveLength(1);
  });
  it('closes a note on silence after the release time', () => {
    const tr = new Tracker();
    feed(tr, 0, 400, note(40));
    const done = feed(tr, 400, 400, silence);
    expect(done).toEqual([{ kind: 'note', t0: 0, t1: 380, midi: 40 }]);
    expect(tr.held).toBeNull();
  });
  it('rides out a brief dropout without splitting the note', () => {
    const tr = new Tracker();
    feed(tr, 0, 300, note(40));
    const done = [...feed(tr, 300, 60, silence), ...feed(tr, 360, 300, note(40))];
    expect(done).toEqual([]);
    expect(tr.flush(660)).toHaveLength(1);
  });
  it('splits when the pitch changes and settles', () => {
    const tr = new Tracker();
    feed(tr, 0, 400, note(40));
    const done = feed(tr, 400, 400, note(43));
    expect(done).toEqual([{ kind: 'note', t0: 0, t1: 400, midi: 40 }]);
    expect(tr.held?.reading).toMatchObject({ pitch: { midi: 43 } });
  });
  it('drops blips shorter than a played note', () => {
    const tr = new Tracker();
    const done = [...feed(tr, 0, 80, note(40)), ...feed(tr, 80, 400, silence)];
    expect(done).toEqual([]);
  });
});
