import {
  contrast,
  distance,
  hueDelta,
  oklchToRgb,
  rgbToOklch,
  toHex,
  type Oklch,
  type RGB,
} from './color';

export type Target = 3 | 4.5 | 7;
export const TARGETS: readonly { value: Target; label: string; hint: string }[] = [
  { value: 4.5, label: 'AA', hint: 'Body text — 4.5 : 1' },
  { value: 3, label: 'AA large / UI', hint: 'Large text, icons, borders — 3 : 1' },
  { value: 7, label: 'AAA', hint: 'Enhanced — 7 : 1' },
];

export type Role = 'text' | 'background';

export interface Fix {
  /** Which colour moved. */
  role: Role;
  rgb: RGB;
  hex: string;
  ratio: number;
  /** Perceptual distance moved; 1 is barely visible. */
  moved: number;
  direction: 'lighter' | 'darker';
  /** True when chroma had to be reduced to stay inside sRGB. */
  chromaReduced: boolean;
}

export type Outcome =
  | { status: 'passes'; ratio: number }
  | { status: 'fixable'; ratio: number; fixes: Fix[]; impossible: Role[] }
  | { status: 'impossible'; ratio: number; impossible: Role[] };

const COARSE = 120;
const FINE = 40;
/** Hue may drift at most this far (degrees) when the original is clearly chromatic. */
export const HUE_TOLERANCE = 2;
const CHROMATIC = 0.04;

/**
 * Nearest colour to `moving` — same hue, same chroma where the gamut allows —
 * that reaches `target` against `fixed`. Scans lightness outward from the
 * original in both directions and tests the *rounded* 8-bit result, so a fix
 * never passes only in floating point. Near black and white, 8-bit steps are
 * coarse enough to rotate hue, so a candidate that drifts is replaced by its best
 * neighbouring byte value, or rejected if none holds the hue.
 */
export function nearestPassing(
  moving: RGB,
  fixed: RGB,
  target: Target,
  role: Role,
): Fix | null {
  const origin = rgbToOklch(moving);
  const holdHue = origin.c >= CHROMATIC;
  let best: Fix | null = null;

  const evaluate = (l: number, dir: 1 | -1): Fix | null => {
    let rgb = oklchToRgb({ l, c: origin.c, h: origin.h });
    let got = rgbToOklch(rgb);
    if (holdHue && hueDelta(got.h, origin.h) > HUE_TOLERANCE) {
      let top: { rgb: RGB; got: Oklch; d: number } | null = null;
      for (const dr of [-1, 0, 1])
        for (const dg of [-1, 0, 1])
          for (const db of [-1, 0, 1]) {
            const n: RGB = [rgb[0] + dr, rgb[1] + dg, rgb[2] + db].map((v) =>
              Math.min(255, Math.max(0, v)),
            ) as unknown as RGB;
            if (contrast(n, fixed) < target) continue;
            const g = rgbToOklch(n);
            const d = hueDelta(g.h, origin.h);
            if (g.c >= CHROMATIC / 4 && d <= HUE_TOLERANCE && (!top || d < top.d))
              top = { rgb: n, got: g, d };
          }
      if (!top) return null;
      rgb = top.rgb;
      got = top.got;
    }
    const ratio = contrast(rgb, fixed);
    if (ratio < target) return null;
    return {
      role,
      rgb,
      hex: toHex(rgb),
      ratio,
      moved: distance(origin, got),
      direction: dir === 1 ? 'lighter' : 'darker',
      chromaReduced: got.c < origin.c - 0.005,
    };
  };

  for (const dir of [1, -1] as const) {
    const limit = dir === 1 ? 1 - origin.l : origin.l;
    const at = (t: number) => origin.l + (dir * limit * t) / COARSE;
    for (let i = 1; i <= COARSE; i++) {
      if (!evaluate(at(i), dir)) continue;
      // First passing coarse step: look for the earliest fine step inside the cell before it.
      let found = evaluate(at(i), dir);
      for (let j = 1; j < FINE; j++) {
        const cand = evaluate(at(i - 1 + j / FINE), dir);
        if (cand) {
          found = cand;
          break;
        }
      }
      if (found && (!best || found.moved < best.moved)) best = found;
      break;
    }
  }
  return best;
}

export function solve(fg: RGB, bg: RGB, target: Target): Outcome {
  const ratio = contrast(fg, bg);
  if (ratio >= target) return { status: 'passes', ratio };
  const text = nearestPassing(fg, bg, target, 'text');
  const background = nearestPassing(bg, fg, target, 'background');
  const fixes = [text, background]
    .filter((f): f is Fix => f !== null)
    .sort((a, b) => a.moved - b.moved);
  const impossible: Role[] = [];
  if (!text) impossible.push('text');
  if (!background) impossible.push('background');
  return fixes.length > 0
    ? { status: 'fixable', ratio, fixes, impossible }
    : { status: 'impossible', ratio, impossible };
}

/**
 * Sample the lightness line of a colour (hue and chroma held) against a fixed
 * colour, for the ribbon. Returns CSS colours and whether each sample passes.
 */
export function ribbon(moving: RGB, fixed: RGB, target: Target, samples = 64) {
  const o = rgbToOklch(moving);
  return Array.from({ length: samples + 1 }, (_, i) => {
    const l = i / samples;
    const rgb = oklchToRgb({ l, c: o.c, h: o.h });
    return { l, hex: toHex(rgb), pass: contrast(rgb, fixed) >= target };
  });
}
