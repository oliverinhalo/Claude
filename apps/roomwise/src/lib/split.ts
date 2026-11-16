export interface Perk {
  id: string;
  label: string;
  /** Percentage points added to (or removed from) a room's weight. */
  pct: number;
}

export interface Room {
  id: string;
  name: string;
  area: number;
  perks: string[];
}

export type AreaUnit = 'm2' | 'ft2';

export interface State {
  rent: number;
  unit: AreaUnit;
  currency: string;
  cents: boolean;
  shared: number;
  rooms: Room[];
  perks: Perk[];
}

export const LIMITS = { rooms: 12, area: 1000, rent: 1_000_000, perk: 50 } as const;

export const FT2_PER_M2 = 10.7639;
/** Area cap for a unit: LIMITS.area is in m²; ft² gets the same physical cap. */
export const areaMax = (unit: AreaUnit): number =>
  unit === 'ft2' ? Math.round(LIMITS.area * FT2_PER_M2) : LIMITS.area;

export const DEFAULT_PERKS: Perk[] = [
  { id: 'ensuite', label: 'Ensuite bathroom', pct: 10 },
  { id: 'balcony', label: 'Balcony or private outdoor space', pct: 5 },
  { id: 'storage', label: 'Built-in storage', pct: 3 },
  { id: 'dark', label: 'Dark or small window', pct: -5 },
  { id: 'noisy', label: 'Street-facing and noisy', pct: -4 },
  { id: 'walkthrough', label: 'Walk-through to another room', pct: -8 },
];

export const EXAMPLE: State = {
  rent: 2100,
  unit: 'm2',
  currency: '£',
  cents: false,
  shared: 24,
  rooms: [
    { id: 'r1', name: 'Front room', area: 18, perks: ['ensuite', 'balcony'] },
    { id: 'r2', name: 'Middle room', area: 12, perks: ['storage'] },
    { id: 'r3', name: 'Back room', area: 9, perks: ['dark', 'noisy'] },
  ],
  perks: DEFAULT_PERKS,
};

export interface RoomShare {
  id: string;
  name: string;
  /** Amount in minor units (cents, or whole units × 100 when cents is off). */
  amount: number;
  /** 0..1 */
  fraction: number;
  area: number;
  sharedPart: number;
  adjustmentPct: number;
  perkLabels: string[];
  valid: boolean;
}

export type Result =
  | { ok: true; shares: RoomShare[]; total: number }
  | { ok: false; reason: string; shares: RoomShare[] };

const finite = (n: number) => Number.isFinite(n);

/** Largest-remainder apportionment: integer parts always sum to `total`. */
export function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(sum > 0) || !finite(sum)) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    left -= 1;
  }
  return floors;
}

export function compute(state: State): Result {
  const { rooms, perks } = state;
  if (rooms.length === 0)
    return { ok: false, reason: 'Add a room to see the split.', shares: [] };
  if (!finite(state.rent) || state.rent <= 0) {
    return { ok: false, reason: 'Enter the total monthly rent.', shares: [] };
  }
  const perkById = new Map(perks.map((p) => [p.id, p]));
  const sharedEach = finite(state.shared) && state.shared > 0 ? state.shared / rooms.length : 0;

  const rows = rooms.map((r) => {
    const valid = finite(r.area) && r.area > 0;
    const chosen = r.perks
      .map((id) => perkById.get(id))
      .filter((p): p is Perk => p !== undefined);
    const adjustmentPct = chosen.reduce((s, p) => s + p.pct, 0);
    const factor = Math.max(0.1, 1 + adjustmentPct / 100);
    const weight = valid ? (r.area + sharedEach) * factor : 0;
    return { r, valid, chosen, adjustmentPct, weight };
  });

  const bad = rows.filter((x) => !x.valid);
  const scale = state.cents ? 100 : 1;
  const totalMinor = Math.round(state.rent * scale);
  const amounts = apportion(
    totalMinor,
    rows.map((x) => x.weight),
  );
  const weightSum = rows.reduce((s, x) => s + x.weight, 0);
  const shares: RoomShare[] = rows.map((x, i) => ({
    id: x.r.id,
    name: x.r.name.trim() || `Room ${i + 1}`,
    amount: x.valid ? (amounts[i] ?? 0) : 0,
    fraction: x.valid && weightSum > 0 ? x.weight / weightSum : 0,
    area: x.r.area,
    sharedPart: sharedEach,
    adjustmentPct: x.adjustmentPct,
    perkLabels: x.chosen.map((p) => p.label),
    valid: x.valid,
  }));
  if (bad.length > 0) {
    return {
      ok: false,
      reason: 'Every room needs a size above zero before the split can be worked out.',
      shares,
    };
  }
  return { ok: true, shares, total: totalMinor };
}

/** Format an amount held in the unit `compute` used (whole units unless cents). */
export function formatAmount(amount: number, state: Pick<State, 'cents' | 'currency'>): string {
  const value = state.cents ? amount / 100 : amount;
  const text = value.toLocaleString('en-GB', {
    minimumFractionDigits: state.cents ? 2 : 0,
    maximumFractionDigits: state.cents ? 2 : 0,
  });
  return `${state.currency}${text}`;
}

export function explain(share: RoomShare, unit: AreaUnit): string {
  const u = unit === 'm2' ? 'm²' : 'ft²';
  const parts = [`${trim(share.area)} ${u}`];
  if (share.sharedPart > 0) parts.push(`${trim(share.sharedPart)} ${u} of shared space`);
  let text = parts.join(' + ');
  if (share.adjustmentPct !== 0) {
    const sign = share.adjustmentPct > 0 ? '+' : '−';
    text += `, ${sign}${Math.abs(share.adjustmentPct)}% for ${share.perkLabels.join(', ').toLowerCase()}`;
  }
  return `${text} → ${(share.fraction * 100).toFixed(1)}% of the rent`;
}

const trim = (n: number) => String(Math.round(n * 10) / 10);

export function summary(state: State, result: Result): string {
  if (!result.ok) return '';
  const lines = result.shares.map((s) => `${s.name}: ${formatAmount(s.amount, state)}`);
  return [
    `Rent split — ${formatAmount(result.total, state)} a month`,
    ...lines,
    'Worked out with Roomwise (by size and perks).',
  ].join('\n');
}
