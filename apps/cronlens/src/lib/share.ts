import { browserZone, isValidZone } from './zone';

export const EXAMPLE = { expr: '30 2 * * *', zone: 'America/New_York' } as const;

export interface State {
  expr: string;
  zone: string;
}

export const isState = (v: unknown): v is State =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as State).expr === 'string' &&
  (v as State).expr.length <= 200 &&
  typeof (v as State).zone === 'string';

export interface FromHash {
  expr?: string;
  zone?: string;
  /** A zone in the link that this browser does not know. */
  rejectedZone?: string;
}

export function readHash(hash: string): FromHash {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const out: FromHash = {};
  const c = params.get('c');
  if (c !== null && c.length <= 200) out.expr = c;
  const z = params.get('z');
  if (z !== null) {
    if (isValidZone(z)) out.zone = z;
    else out.rejectedZone = z.slice(0, 60);
  }
  return out;
}

export function buildHash(state: State): string {
  const p = new URLSearchParams({ c: state.expr, z: state.zone });
  return `#${p.toString()}`;
}

/** Resolve the starting state: link beats stored beats the example. */
export function initialState(
  hash: string,
  stored: State,
): { state: State; notice: string | null } {
  const h = readHash(hash);
  const state: State = {
    expr: h.expr ?? stored.expr,
    zone:
      h.zone ??
      (h.rejectedZone === undefined && isValidZone(stored.zone) ? stored.zone : browserZone()),
  };
  const notice = h.rejectedZone
    ? `This browser does not know the time zone "${h.rejectedZone}", so Cronlens is using ${state.zone}.`
    : null;
  return { state, notice };
}
