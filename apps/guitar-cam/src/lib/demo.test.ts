import { describe, expect, it } from 'vitest';
import { DEMO_LENGTH_MS, DEMO_STEPS, demoWindow } from './demo';
import { WINDOW, analyze } from './analyzer';
import { Tracker } from './tracker';

const SR = 44100;

describe('demo performance', () => {
  it('is heard by the real analyser as the notes and chords it was written as', () => {
    const tracker = new Tracker();
    const heard: string[] = [];
    for (let t = 0; t < DEMO_LENGTH_MS; t += 40) {
      for (const e of tracker.push(t, analyze(demoWindow(t, SR, WINDOW), SR))) {
        heard.push(e.kind === 'note' ? `n${e.midi}` : e.chord.name);
      }
    }
    for (const e of tracker.flush(DEMO_LENGTH_MS)) {
      heard.push(e.kind === 'note' ? `n${e.midi}` : e.chord.name);
    }
    expect(heard).toEqual([
      'n45',
      'n48',
      'n50',
      'n52',
      'n55',
      'n52',
      'n50',
      'n48',
      'Em',
      'C',
      'G',
      'D',
    ]);
  });
  it('is silent before the first note', () => {
    expect(demoWindow(100, SR, WINDOW).every((v) => v === 0)).toBe(true);
    expect(DEMO_STEPS.length).toBeGreaterThan(8);
  });
});
