import { createStore } from './storage';
import type { Target } from './fix';

export interface HuekeepState {
  fg: string;
  bg: string;
  target: Target;
}

/** A real failing pair: brand orange on white (3.6 : 1). Useful before any input. */
export const SEED: HuekeepState = { fg: '#e8590c', bg: '#ffffff', target: 4.5 };

export const isTarget = (v: unknown): v is Target => v === 3 || v === 4.5 || v === 7;

export const isState = (v: unknown): v is HuekeepState =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as HuekeepState).fg === 'string' &&
  typeof (v as HuekeepState).bg === 'string' &&
  (v as HuekeepState).fg.length <= 64 &&
  (v as HuekeepState).bg.length <= 64 &&
  isTarget((v as HuekeepState).target);

export const store = createStore<HuekeepState>({
  key: 'huekeep:state',
  version: 1,
  fallback: SEED,
  validate: isState,
});

/** Read a shared link (`#fg=…&bg=…&t=4.5`). Anything malformed returns null. */
export function fromHash(hash: string): HuekeepState | null {
  if (hash.length < 2 || hash.length > 300) return null;
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const fg = p.get('fg');
  const bg = p.get('bg');
  const t = Number(p.get('t') ?? 4.5);
  if (fg === null || bg === null || !isTarget(t)) return null;
  const s = { fg, bg, target: t };
  return isState(s) ? s : null;
}

export function toHash(s: HuekeepState): string {
  const p = new URLSearchParams({ fg: s.fg, bg: s.bg, t: String(s.target) });
  return '#' + p.toString();
}
