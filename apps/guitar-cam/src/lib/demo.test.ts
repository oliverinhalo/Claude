import { describe, expect, it } from 'vitest';
import { DEMO_LENGTH_MS, DEMO_STEPS, demoWindow } from './demo';
import { WINDOW, createAnalyzer } from './analyzer';
import { Tracker } from './tracker';
import type { RawEvent } from './take';

const SR = 44100;

function heardAt(frameMs: number, offsetMs: number): string[] {
  const analyze = createAnalyzer();
  const tracker = new Tracker();
  const name = (e: RawEvent) => (e.kind === 'note' ? `n${e.midi}` : e.chord.name);
  const heard: string[] = [];
  for (let t = offsetMs; t < DEMO_LENGTH_MS; t += frameMs) {
    for (const e of tracker.push(t, analyze(demoWindow(t, SR, WINDOW), SR, t)))
      heard.push(name(e));
  }
  for (const e of tracker.flush(DEMO_LENGTH_MS)) heard.push(name(e));
  return heard;
}

const WRITTEN = ['n45', 'n48', 'n50', 'n52', 'n55', 'n52', 'n50', 'n48', 'Em', 'C', 'G', 'D'];

describe('demo performance', () => {
  it('holds each chord for most of the time it rings, not just its first instant', () => {
    const analyze = createAnalyzer();
    const tracker = new Tracker();
    const held: Record<string, number> = {};
    for (let t = 0; t < DEMO_LENGTH_MS; t += 33) {
      for (const e of tracker.push(t, analyze(demoWindow(t, SR, WINDOW), SR, t))) {
        if (e.kind === 'chord') held[e.chord.name] = e.t1 - e.t0;
      }
    }
    for (const name of ['Em', 'C', 'G', 'D']) expect(held[name]).toBeGreaterThan(900);
  });

  // Real frames arrive at uneven phases; the answer must not depend on where they land.
  for (const [frame, offset] of [
    [33, 0],
    [33, 11],
    [33, 22],
    [40, 0],
    [25, 7],
  ] as const) {
    it(`is heard as written at ${frame} ms frames, offset ${offset}`, () => {
      expect(heardAt(frame, offset)).toEqual(WRITTEN);
    }, 30000);
  }
  it('is silent before the first note', () => {
    expect(demoWindow(100, SR, WINDOW).every((v) => v === 0)).toBe(true);
    expect(DEMO_STEPS.length).toBeGreaterThan(8);
  });
});
