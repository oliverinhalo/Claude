/**
 * Time-zone arithmetic on top of Intl, with no tz database shipped.
 *
 * Two kinds of number appear throughout:
 *  - an instant: ms since the epoch, the same everywhere;
 *  - a wall reading: the clock on the wall, encoded as ms "as if UTC"
 *    (so 02:30 on 9 March is Date.UTC(2025, 2, 9, 2, 30)).
 * A zone maps instants to wall readings uniquely, but wall readings to instants
 * ambiguously: zero (clocks skipped it), one, or two (clocks repeated it).
 */

const MINUTE = 60_000;
const HOUR = 3_600_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

export function isValidZone(zone: string): boolean {
  if (zone === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      era: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(zone, f);
  }
  return f;
}

/** The wall reading of an instant, in ms as-if-UTC. Seconds are kept. */
export function wallAt(instant: number, zone: string): number {
  const parts = formatter(zone).formatToParts(new Date(Math.floor(instant / 1000) * 1000));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const era = parts.find((p) => p.type === 'era')?.value ?? 'AD';
  const year = era.startsWith('B') ? 1 - get('year') : get('year');
  const d = new Date(0);
  d.setUTCFullYear(year, get('month') - 1, get('day'));
  d.setUTCHours(get('hour') % 24, get('minute'), get('second'), 0);
  return d.getTime();
}

/** Offset from UTC in ms at an instant (positive east of Greenwich). */
export function offsetAt(instant: number, zone: string): number {
  return wallAt(instant, zone) - Math.floor(instant / 1000) * 1000;
}

/**
 * Every instant at which the wall clock in `zone` reads `wall`, ascending.
 * [] when the reading was skipped, two entries when it happened twice.
 */
export function wallToInstants(wall: number, zone: string): number[] {
  const offsets = new Set([
    offsetAt(wall - 36 * HOUR, zone),
    offsetAt(wall, zone),
    offsetAt(wall + 36 * HOUR, zone),
  ]);
  const out: number[] = [];
  for (const off of offsets) {
    const t = wall - off;
    if (offsetAt(t, zone) === off && !out.includes(t)) out.push(t);
  }
  return out.sort((a, b) => a - b);
}

export interface ClockChange {
  /** The instant the offset changes. */
  at: number;
  offsetBefore: number;
  offsetAfter: number;
  /** Half-open range of wall readings affected: [from, to). */
  from: number;
  to: number;
  kind: 'skipped' | 'doubled';
}

/** Clock changes in [start, end), found by scanning in 12 h steps then bisecting. */
export function clockChanges(zone: string, start: number, end: number): ClockChange[] {
  const out: ClockChange[] = [];
  const STEP = 12 * HOUR;
  let t0 = start;
  let o0 = offsetAt(t0, zone);
  while (t0 < end) {
    const t1 = Math.min(t0 + STEP, end);
    const o1 = offsetAt(t1, zone);
    if (o1 !== o0) {
      let lo = t0;
      let hi = t1;
      while (hi - lo > MINUTE) {
        const mid = Math.floor((lo + hi) / 2 / MINUTE) * MINUTE;
        if (mid <= lo) break;
        if (offsetAt(mid, zone) === o0) lo = mid;
        else hi = mid;
      }
      const at = hi;
      const before = offsetAt(at - 1, zone);
      const after = offsetAt(at, zone);
      if (after !== before) {
        out.push(
          after > before
            ? {
                at,
                offsetBefore: before,
                offsetAfter: after,
                from: at + before,
                to: at + after,
                kind: 'skipped',
              }
            : {
                at,
                offsetBefore: before,
                offsetAfter: after,
                from: at + after,
                to: at + before,
                kind: 'doubled',
              },
        );
      }
    }
    t0 = t1;
    o0 = o1;
  }
  return out;
}

/** "UTC−5", "UTC+5:30" */
export function formatOffset(offsetMs: number): string {
  if (offsetMs === 0) return 'UTC';
  const sign = offsetMs < 0 ? '−' : '+';
  const mins = Math.round(Math.abs(offsetMs) / MINUTE);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

export function browserZone(): string {
  try {
    const z = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidZone(z) ? z : 'UTC';
  } catch {
    return 'UTC';
  }
}

const MODERN_NAMES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Godthab': 'America/Nuuk',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Truk': 'Pacific/Chuuk',
};

export function allZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  let zones: string[] = [];
  try {
    zones = intl.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    zones = [];
  }
  // Engines list legacy canonical ids (Asia/Calcutta); people type the modern ones.
  zones = zones.map((z) => {
    const modern = MODERN_NAMES[z];
    return modern && isValidZone(modern) ? modern : z;
  });
  if (!zones.includes('UTC')) zones = ['UTC', ...zones];
  return [...new Set(zones)].sort((a, b) =>
    a === 'UTC' ? -1 : b === 'UTC' ? 1 : a.localeCompare(b),
  );
}
