import { createStore } from './storage';
import { TEMP_MAX, TEMP_MIN, type Method, type Plan } from './schedule';

export interface Saved {
  method: Method;
  roomTemp: number;
}

export const SAVED_FALLBACK: Saved = { method: 'same-day', roomTemp: 22 };

export function isSaved(v: unknown): v is Saved {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    (o.method === 'same-day' || o.method === 'overnight') &&
    typeof o.roomTemp === 'number' &&
    Number.isFinite(o.roomTemp) &&
    o.roomTemp >= TEMP_MIN &&
    o.roomTemp <= TEMP_MAX
  );
}

export const savedStore = createStore<Saved>({
  key: 'crumb-clock:state',
  version: 1,
  fallback: SAVED_FALLBACK,
  validate: isSaved,
});

/** Encode a plan for the URL hash: `#t=<epoch minutes>&m=o|s&c=<temp>`. */
export function encodePlan(plan: Plan): string {
  const m = plan.method === 'overnight' ? 'o' : 's';
  return `t=${Math.round(plan.readyAt / 60000)}&m=${m}&c=${plan.roomTemp}`;
}

/** Decode a hash. Anything malformed yields null; never throws. */
export function decodePlan(hash: string): Plan | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const t = Number(params.get('t'));
  const c = Number(params.get('c'));
  const m = params.get('m');
  if (!Number.isInteger(t) || t <= 0 || t > 100_000_000) return null;
  if (!Number.isFinite(c) || c < TEMP_MIN || c > TEMP_MAX) return null;
  if (m !== 'o' && m !== 's') return null;
  return { readyAt: t * 60000, method: m === 'o' ? 'overnight' : 'same-day', roomTemp: c };
}
