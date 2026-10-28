/**
 * Monophonic pitch detection: the McLeod Pitch Method (normalised square-difference
 * function with peak picking). It is robust against the strong second harmonic a guitar
 * produces, which plain autocorrelation mistakes for the fundamental.
 */

export interface PitchResult {
  frequency: number;
  /** 0–1. How periodic the signal is. Single notes score high; strums and noise score low. */
  clarity: number;
}

export const MIN_FREQ = 70;
export const MAX_FREQ = 1400;

export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += (samples[i] as number) ** 2;
  return Math.sqrt(sum / Math.max(1, samples.length));
}

export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  threshold = 0.9,
): PitchResult | null {
  const n = samples.length;
  const maxLag = Math.min(Math.floor(sampleRate / MIN_FREQ), n >> 1);
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQ));
  if (maxLag <= minLag + 2) return null;

  // Normalised square difference function over the lags of interest.
  const nsdf = new Float32Array(maxLag + 1);
  // m(tau) is accumulated incrementally; the window shrinks as the lag grows.
  const window = n - maxLag;
  let energyHead = 0;
  let energyTail = 0;
  for (let i = 0; i < window; i++) energyHead += (samples[i] as number) ** 2;
  for (let tau = 0; tau <= maxLag; tau++) {
    let acf = 0;
    energyTail = 0;
    for (let i = 0; i < window; i++) {
      const b = samples[i + tau] as number;
      acf += (samples[i] as number) * b;
      energyTail += b * b;
    }
    const m = energyHead + energyTail;
    nsdf[tau] = m > 1e-12 ? (2 * acf) / m : 0;
  }

  // Key maxima: the highest point of each positive lobe after the first zero crossing.
  const peaks: number[] = [];
  let tau = minLag;
  while (tau < maxLag && (nsdf[tau] as number) > 0) tau++; // skip the lobe at zero lag
  while (tau < maxLag) {
    while (tau < maxLag && (nsdf[tau] as number) <= 0) tau++;
    let best = -1;
    while (tau < maxLag && (nsdf[tau] as number) > 0) {
      if (best < 0 || (nsdf[tau] as number) > (nsdf[best] as number)) best = tau;
      tau++;
    }
    if (best > 0 && best >= minLag) peaks.push(best);
  }
  if (peaks.length === 0) return null;

  const highest = Math.max(...peaks.map((p) => nsdf[p] as number));
  if (highest < 0.5) return null;
  const cutoff = threshold * highest;
  const chosen = peaks.find((p) => (nsdf[p] as number) >= cutoff);
  if (chosen === undefined) return null;

  // Parabolic interpolation for sub-sample precision.
  const a = nsdf[chosen - 1] as number;
  const b = nsdf[chosen] as number;
  const c = nsdf[chosen + 1] as number;
  const denom = a - 2 * b + c;
  const shift = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
  const period = chosen + shift;
  const clarity = b - 0.25 * (a - c) * shift;
  return { frequency: sampleRate / period, clarity: Math.min(1, clarity) };
}
