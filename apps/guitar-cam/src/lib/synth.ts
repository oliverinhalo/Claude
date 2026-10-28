import { midiToFreq } from './music';

/**
 * A plucked-string approximation: a harmonic series with a stiff decay. Used by the
 * demo (so the page is alive without a microphone) and by the detector tests.
 */
export function pluck(
  midi: number,
  sampleRate: number,
  length: number,
  startSample = 0,
  amplitude = 0.3,
): Float32Array {
  const out = new Float32Array(length);
  const f0 = midiToFreq(midi);
  const harmonics = 8;
  for (let i = 0; i < length; i++) {
    const t = (i + startSample) / sampleRate;
    if (t < 0) continue; // this string has not been plucked yet
    let v = 0;
    for (let h = 1; h <= harmonics; h++) {
      if (f0 * h > sampleRate / 2.2) break;
      v += (Math.sin(2 * Math.PI * f0 * h * t) / h ** 1.1) * Math.exp(-t * (0.6 + h * 0.5));
    }
    out[i] = v * amplitude;
  }
  return out;
}

/** Several strings sounding together, each a few milliseconds apart like a real strum. */
export function strum(
  midis: readonly number[],
  sampleRate: number,
  length: number,
  startSample = 0,
): Float32Array {
  const out = new Float32Array(length);
  midis.forEach((midi, k) => {
    const delay = Math.round(sampleRate * 0.012 * k);
    const voice = pluck(midi, sampleRate, length, startSample, 0.18);
    for (let i = delay; i < length; i++)
      out[i] = (out[i] as number) + (voice[i - delay] as number);
  });
  return out;
}

export function noise(length: number, amplitude = 0.2, seed = 1): Float32Array {
  const out = new Float32Array(length);
  let s = seed;
  for (let i = 0; i < length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = ((s / 0xffffffff) * 2 - 1) * amplitude;
  }
  return out;
}
