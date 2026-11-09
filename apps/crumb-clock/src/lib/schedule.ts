/**
 * The schedule engine: work backwards from the moment bread should be ready.
 * Pure functions only — no clocks, no storage — so every rule is unit-testable.
 */

export type Method = 'same-day' | 'overnight';

export interface Plan {
  /** When the loaf should be sliceable, as epoch milliseconds. */
  readyAt: number;
  method: Method;
  /** Kitchen temperature in °C. */
  roomTemp: number;
}

export interface Step {
  id: string;
  title: string;
  detail: string;
  /** Epoch ms when the step begins. */
  at: number;
  /** Length of the step in minutes. */
  minutes: number;
  /** True when the step starts during quiet hours and needs the human awake. */
  antisocial: boolean;
}

export const TEMP_MIN = 15;
export const TEMP_MAX = 32;
export const MINUTE = 60_000;

/** Fermentation roughly halves in time for every 8 °C of warmth. Baseline 24 °C. */
export function tempFactor(roomTemp: number): number {
  const t = Math.min(TEMP_MAX, Math.max(TEMP_MIN, roomTemp));
  return Math.pow(2, (24 - t) / 8);
}

const roundTo5 = (n: number): number => Math.max(5, Math.round(n / 5) * 5);

/** Hour of day (0–23) in local time for an epoch ms. */
export function isQuietHour(ms: number): boolean {
  const d = new Date(ms);
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins >= 22 * 60 + 30 || mins < 6 * 60 + 30;
}

interface Blueprint {
  id: string;
  title: string;
  detail: string;
  minutes: number;
}

/** Steps in forward order, with durations already scaled for temperature. */
export function blueprint(method: Method, roomTemp: number): Blueprint[] {
  const f = tempFactor(roomTemp);
  const steps: Blueprint[] = [
    {
      id: 'feed',
      title: 'Feed your starter',
      detail:
        'Mix 1 part starter, 5 parts flour and 5 parts water. It is ready when it has doubled and domes.',
      minutes: roundTo5(240 * f),
    },
    {
      id: 'mix',
      title: 'Mix the dough',
      detail: 'Combine flour, water and starter. Rest, then work in the salt.',
      minutes: 30,
    },
    {
      id: 'bulk',
      title: 'Bulk ferment',
      detail:
        'Fold the dough every 30 minutes for the first 2 hours, then leave it. It is done when it is up about 50% and jiggly.',
      minutes: roundTo5((method === 'overnight' ? 270 : 300) * f),
    },
    {
      id: 'shape',
      title: 'Shape the loaf',
      detail: 'Pre-shape, rest 20 minutes, then final shape and place in a floured banneton.',
      minutes: 30,
    },
  ];
  if (method === 'overnight') {
    steps.push({
      id: 'proof',
      title: 'Cold proof in the fridge',
      detail: 'Cover and chill. The cold slows the dough, so this window is forgiving.',
      minutes: 12 * 60,
    });
  } else {
    steps.push({
      id: 'proof',
      title: 'Final proof',
      detail: 'Leave covered at room temperature. Poke test: the dent springs back slowly.',
      minutes: roundTo5(120 * f),
    });
  }
  steps.push(
    {
      id: 'preheat',
      title: 'Preheat the oven',
      detail: 'Heat to 245 °C (475 °F) with your Dutch oven inside.',
      minutes: 45,
    },
    {
      id: 'bake',
      title: 'Score and bake',
      detail: '20 minutes with the lid on, then 25 minutes with it off.',
      minutes: 45,
    },
    {
      id: 'cool',
      title: 'Cool on a rack',
      detail: 'Do not cut early. The crumb is still setting. Then slice and eat.',
      minutes: 60,
    },
  );
  return steps;
}

/** Back-schedule from `plan.readyAt`. The returned steps are in forward order. */
export function buildSchedule(plan: Plan): Step[] {
  const steps = blueprint(plan.method, plan.roomTemp);
  const out: Step[] = [];
  let end = plan.readyAt;
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i];
    if (!s) continue;
    const at = end - s.minutes * MINUTE;
    out.unshift({ ...s, at, antisocial: s.id !== 'proof' && isQuietHour(at) });
    end = at;
  }
  // A step that starts in quiet hours is only antisocial if a person must act there.
  return out;
}

export function totalMinutes(steps: Step[]): number {
  return steps.reduce((sum, s) => sum + s.minutes, 0);
}

/** The earliest ready time that still lets the first step start at or after `now`. */
export function earliestReady(now: number, method: Method, roomTemp: number): number {
  const total = totalMinutes(buildSchedule({ readyAt: now, method, roomTemp }));
  return now + total * MINUTE;
}

export function isFeasible(plan: Plan, now: number): boolean {
  const first = buildSchedule(plan)[0];
  return first !== undefined && first.at >= now - MINUTE;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Format an epoch ms as the value of a datetime-local input. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a datetime-local value. Returns null for anything that is not a real time. */
export function fromLocalInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y = 0, mo = 0, d = 0, h = 0, mi = 0] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  const t = date.getTime();
  return Number.isFinite(t) ? t : null;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Sensible default: the earliest half-hour that is feasible and wakes nobody up
 * (no step starts in quiet hours, apart from the fridge proof).
 */
export function defaultReadyAt(now: number, method: Method, roomTemp: number): number {
  const half = 30 * MINUTE;
  const start = Math.ceil(earliestReady(now, method, roomTemp) / half) * half;
  for (let t = start; t < start + 48 * 60 * MINUTE; t += half) {
    if (!buildSchedule({ readyAt: t, method, roomTemp }).some((s) => s.antisocial)) return t;
  }
  return start;
}
