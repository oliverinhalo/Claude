import { strum, pluck } from './synth';

/**
 * The demo performance: an Am-pentatonic lick, then Em – C – G – D. It is rendered through
 * the same analyser as a real microphone, so what the visitor sees is the product working,
 * not an animation.
 */
export interface DemoStep {
  at: number;
  ms: number;
  /** One pitch is a plucked note; several are a strum. */
  midis: number[];
}

const lick: Array<[number, number]> = [
  [45, 420],
  [48, 420],
  [50, 420],
  [52, 620],
  [55, 420],
  [52, 420],
  [50, 420],
  [48, 620],
];
const chords: Array<[number[], number]> = [
  [[40, 47, 52, 55, 59, 64], 1500],
  [[48, 52, 55, 60, 64], 1500],
  [[43, 47, 50, 55, 59, 67], 1500],
  [[50, 57, 62, 66], 1500],
];

function build(): DemoStep[] {
  const steps: DemoStep[] = [];
  let at = 300;
  for (const [midi, ms] of lick) {
    steps.push({ at, ms, midis: [midi] });
    at += ms + 90;
  }
  at += 300;
  for (const [midis, ms] of chords) {
    steps.push({ at, ms, midis });
    at += ms + 250;
  }
  return steps;
}

export const DEMO_STEPS: readonly DemoStep[] = build();
export const DEMO_LENGTH_MS = (DEMO_STEPS[DEMO_STEPS.length - 1] as DemoStep).at + 2200;

const rendered = new Map<number, Float32Array>();

/** The whole loop as audio, made once per sample rate. */
function render(sampleRate: number): Float32Array {
  const cached = rendered.get(sampleRate);
  if (cached) return cached;
  const total = Math.round((DEMO_LENGTH_MS / 1000) * sampleRate);
  const out = new Float32Array(total);
  for (const step of DEMO_STEPS) {
    const onset = Math.round((step.at / 1000) * sampleRate);
    const length = Math.min(total - onset, Math.round((step.ms / 1000) * sampleRate));
    const voice =
      step.midis.length === 1
        ? pluck(step.midis[0] as number, sampleRate, length, 0)
        : strum(step.midis, sampleRate, length, 0);
    // Strings are damped at the end of the step, as a player would lift off.
    const fade = Math.round(sampleRate * 0.03);
    for (let i = 0; i < length; i++) {
      const gain = i > length - fade ? (length - i) / fade : 1;
      out[onset + i] = (out[onset + i] as number) + (voice[i] as number) * gain;
    }
  }
  rendered.set(sampleRate, out);
  return out;
}

/** The most recent `length` samples of the demo, as heard at time `ms` (looping). */
export function demoWindow(ms: number, sampleRate: number, length: number): Float32Array {
  const loop = render(sampleRate);
  const end = Math.round(((Math.max(0, ms) % DEMO_LENGTH_MS) / 1000) * sampleRate);
  const start = end - length;
  const out = new Float32Array(length);
  const from = Math.max(0, start);
  out.set(loop.subarray(from, end), from - start);
  return out;
}
