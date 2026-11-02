/** Colour maths: parsing, WCAG contrast, and OKLCH conversion. Pure functions only. */

export type RGB = readonly [number, number, number]; // 0–255 integers
export interface Oklch {
  l: number; // 0–1
  c: number; // 0–~0.4
  h: number; // degrees 0–360
}

export type ParseResult = { ok: true; rgb: RGB } | { ok: false; reason: string };

export const MAX_INPUT_LENGTH = 64;

const NAMES: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  orange: '#ffa500',
  purple: '#800080',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  navy: '#000080',
  teal: '#008080',
  olive: '#808000',
  lime: '#00ff00',
  aqua: '#00ffff',
  fuchsia: '#ff00ff',
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function hslToRgb(h: number, s: number, l: number): RGB {
  const hh = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + hh / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function channel(token: string): number | null {
  const m = /^([+-]?\d*\.?\d+)(%?)$/.exec(token);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] ? (n / 100) * 255 : n;
}

export function parseColor(input: string): ParseResult {
  if (input.length > MAX_INPUT_LENGTH) {
    return { ok: false, reason: `That is ${input.length} characters; a colour is under ${MAX_INPUT_LENGTH}.` };
  }
  const s = input.trim().toLowerCase();
  if (s === '') {
    return { ok: false, reason: 'Type a colour like #1a73e8, rgb(26 115 232) or hsl(217 80% 51%).' };
  }
  if (s === 'transparent') {
    return { ok: false, reason: 'Transparent has no colour to measure. Use the solid colour it sits on.' };
  }
  const named = NAMES[s];
  if (named) return parseColor(named);

  const hex = /^#?([0-9a-f]+)$/.exec(s);
  if (hex && s.startsWith('#')) {
    let h = hex[1] ?? '';
    if (h.length === 4 || h.length === 8) {
      return {
        ok: false,
        reason: 'This colour has transparency. Contrast depends on what is behind it, so give the solid result instead.',
      };
    }
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6) return { ok: false, reason: 'A hex colour has 3 or 6 digits, like #1a73e8.' };
    return {
      ok: true,
      rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)],
    };
  }
  if (/^[0-9a-f]{6}$/.test(s)) return parseColor('#' + s);

  const fn = /^(rgba?|hsla?)\(\s*([^)]*)\)$/.exec(s);
  if (fn) {
    const kind = fn[1] ?? '';
    const parts = (fn[2] ?? '').split(/[\s,/]+/).filter(Boolean);
    if (parts.length === 4 && Number(parts[3]?.replace('%', '')) !== (parts[3]?.endsWith('%') ? 100 : 1)) {
      return { ok: false, reason: 'This colour has transparency. Give the solid result instead.' };
    }
    if (parts.length < 3 || parts.length > 4) {
      return { ok: false, reason: `${kind}() needs three values, like ${kind.startsWith('rgb') ? 'rgb(26 115 232)' : 'hsl(217 80% 51%)'}.` };
    }
    if (kind.startsWith('rgb')) {
      const vals = parts.slice(0, 3).map(channel);
      if (vals.some((v) => v === null)) return { ok: false, reason: 'rgb() values must be numbers, like rgb(26 115 232).' };
      return { ok: true, rgb: vals.map((v) => Math.round(clamp(v as number, 0, 255))) as unknown as RGB };
    }
    const hue = Number((parts[0] ?? '').replace(/deg$/, ''));
    const sat = channel(parts[1] ?? '');
    const lig = channel(parts[2] ?? '');
    if (!Number.isFinite(hue) || sat === null || lig === null || !(parts[1] ?? '').endsWith('%') || !(parts[2] ?? '').endsWith('%')) {
      return { ok: false, reason: 'hsl() wants a hue and two percentages, like hsl(217 80% 51%).' };
    }
    return { ok: true, rgb: hslToRgb(hue, clamp(sat / 255, 0, 1), clamp(lig / 255, 0, 1)) };
  }
  return { ok: false, reason: `“${s.slice(0, 24)}” is not a colour I know. Try #1a73e8, rgb(26 115 232) or hsl(217 80% 51%).` };
}

export const toHex = (rgb: RGB): string =>
  '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** WCAG 2.x relative luminance. */
export function luminance(rgb: RGB): number {
  const [r, g, b] = rgb;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// --- OKLab / OKLCH (Björn Ottosson) -----------------------------------------

function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return c * 255;
}

export function rgbToOklch(rgb: RGB): Oklch {
  const r = toLinear(rgb[0]);
  const g = toLinear(rgb[1]);
  const b = toLinear(rgb[2]);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  const h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/** Unclamped linear-light sRGB for an OKLCH colour (values may fall outside 0–1). */
function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const EPS = 1e-6;
const inGamut = (lin: readonly number[]) => lin.every((v) => v >= -EPS && v <= 1 + EPS);

/**
 * Convert OKLCH to an 8-bit sRGB colour. If the colour is outside the sRGB
 * gamut, chroma is reduced (hue and lightness held) until it fits. This is why
 * the fixer keeps hue: gamut mapping never rotates it.
 */
export function oklchToRgb(color: Oklch): RGB {
  const l = clamp(color.l, 0, 1);
  let lin = oklchToLinear({ ...color, l });
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = color.c;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ l, c: mid, h: color.h }))) lo = mid;
      else hi = mid;
    }
    lin = oklchToLinear({ l, c: lo, h: color.h });
  }
  return lin.map((v) => clamp(Math.round(linearToSrgb(clamp(v, 0, 1))), 0, 255)) as unknown as RGB;
}

/** Perceptual distance (Euclidean in OKLab, ×100 so 1 ≈ barely noticeable). */
export function distance(a: Oklch, b: Oklch): number {
  const ax = a.c * Math.cos((a.h * Math.PI) / 180);
  const ay = a.c * Math.sin((a.h * Math.PI) / 180);
  const bx = b.c * Math.cos((b.h * Math.PI) / 180);
  const by = b.c * Math.sin((b.h * Math.PI) / 180);
  return 100 * Math.hypot(a.l - b.l, ax - bx, ay - by);
}

/** Smallest angle between two hues, degrees. */
export const hueDelta = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
