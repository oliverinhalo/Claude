import { createStore } from './storage';
import {
  areaMax,
  DEFAULT_PERKS,
  EXAMPLE,
  LIMITS,
  type AreaUnit,
  type Perk,
  type Room,
  type State,
} from './split';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function validRoom(v: unknown, max: number): v is Room {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    v.name.length <= 60 &&
    typeof v.area === 'number' &&
    Number.isFinite(v.area) &&
    v.area >= 0 &&
    v.area <= max &&
    Array.isArray(v.perks) &&
    v.perks.every((p) => typeof p === 'string')
  );
}

function validPerk(v: unknown): v is Perk {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    v.label.length <= 60 &&
    num(v.pct, -LIMITS.perk, LIMITS.perk)
  );
}

export function isState(v: unknown): v is State {
  return (
    isObj(v) &&
    typeof v.rent === 'number' &&
    Number.isFinite(v.rent) &&
    v.rent >= 0 &&
    v.rent <= LIMITS.rent &&
    (v.unit === 'm2' || v.unit === 'ft2') &&
    typeof v.currency === 'string' &&
    v.currency.length <= 3 &&
    typeof v.cents === 'boolean' &&
    num(v.shared, 0, areaMax(v.unit as AreaUnit)) &&
    Array.isArray(v.rooms) &&
    v.rooms.length <= LIMITS.rooms &&
    v.rooms.every((r) => validRoom(r, areaMax(v.unit as AreaUnit))) &&
    Array.isArray(v.perks) &&
    v.perks.length <= 20 &&
    v.perks.every(validPerk)
  );
}

export const store = createStore<State>({
  key: 'roomwise:state',
  version: 1,
  fallback: EXAMPLE,
  validate: isState,
});

function b64encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64decode(text: string): string {
  const pad = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Cleared or invalid number fields are NaN in memory; JSON would turn them into null. */
export function serializable(state: State): State {
  const n = (v: number) => (Number.isFinite(v) ? v : 0);
  return {
    ...state,
    rent: n(state.rent),
    shared: n(state.shared),
    rooms: state.rooms.map((r) => ({ ...r, area: n(r.area) })),
  };
}

export function encodeState(state: State): string {
  return `s=${b64encode(JSON.stringify(serializable(state)))}`;
}

export type HashResult =
  { status: 'none' } | { status: 'ok'; state: State } | { status: 'bad' };

export function decodeHash(hash: string): HashResult {
  const m = /^#?s=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m?.[1]) return /^#?s=/.test(hash) ? { status: 'bad' } : { status: 'none' };
  try {
    const parsed: unknown = JSON.parse(b64decode(m[1]));
    return isState(parsed) ? { status: 'ok', state: parsed } : { status: 'bad' };
  } catch {
    return { status: 'bad' };
  }
}

export interface Loaded {
  state: State;
  notice: string | null;
}

export function loadInitial(hash: string): Loaded {
  const h = decodeHash(hash);
  if (h.status === 'ok') return { state: h.state, notice: null };
  if (h.status === 'bad') {
    return {
      state: EXAMPLE,
      notice: 'That share link could not be read, so here is the example instead.',
    };
  }
  const r = store.load();
  if (r.status === 'recovered') {
    return {
      state: EXAMPLE,
      notice: `Your saved split could not be restored (${r.reason}), so here is the example instead.`,
    };
  }
  return { state: r.value, notice: null };
}

export function newRoom(n: number): Room {
  return {
    id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name: `Room ${n}`,
    area: 10,
    perks: [],
  };
}

export const UNITS: AreaUnit[] = ['m2', 'ft2'];
export { DEFAULT_PERKS };
