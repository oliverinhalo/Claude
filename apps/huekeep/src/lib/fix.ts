import {
  contrast,
  distance,
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

const STEPS = 1000;

/**
 * Nearest colour to `moving` — same hue, same chroma where the gamut allows —
 * that reaches `target` against `fixed`. Scans lightness outward from the
 * original in both directions and tests the *rounded* 8-bit result, so a fix
 * never passes only in floating point.
 */
export function nearestPassing(
  moving: RGB,
  fixed: RGB,
  target: Target,
  role: Role,
): Fix | null {
  const origin = rgbToOklch(moving);
  let best: Fix | null = null;

  for (const dir of [1, -1] as const) {
    const limit = dir === 1 ? 1 - origin.l : origin.l;
    for (let i = 1; i <= STEPS; i++) {
      const l = origin.l + (dir * (limit * i)) / STEPS;
      const candidate: Oklch = { l, c: origin.c, h: origin.h };
      const rgb = oklchToRgb(candidate);
      const ratio = contrast(rgb, fixed);
      if (ratio >= target) {
        const got = rgbToOklch(rgb);
        const moved = distance(origin, got);
        if (!best || moved < best.moved) {
          best = {
            role,
            rgb,
            hex: toHex(rgb),
            ratio,
            moved,
            direction: dir === 1 ? 'lighter' : 'darker',
            chromaReduced: got.c < origin.c - 0.005,
          };
        }
        break;
      }
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
