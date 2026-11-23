import { compactDate, compactTime, daysInMonth, pad, WEEKDAY_CODES } from './dates';

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidZone(tz: string): boolean {
  try {
    formatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** Offset from UTC in minutes at a UTC instant (positive = east of Greenwich). */
export function offsetMinutes(utcMs: number, tz: string): number {
  const p: Record<string, number> = {};
  for (const part of formatter(tz).formatToParts(new Date(utcMs))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/** Convert a wall-clock time in a zone to a UTC instant (ms). */
export function wallToUtc(y: number, mo0: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, mo0, d, h, mi);
  let utc = guess - offsetMinutes(guess, tz) * 60_000;
  utc = guess - offsetMinutes(utc, tz) * 60_000;
  return utc;
}

const fmtOffset = (mins: number): string => {
  const sign = mins < 0 ? '-' : '+';
  const a = Math.abs(mins);
  return `${sign}${pad(Math.floor(a / 60))}${pad(a % 60)}`;
};

interface Transition {
  at: number; // UTC ms of the first instant with the new offset
  from: number;
  to: number;
}

/** Find offset changes during a calendar year (UTC), to the minute. */
export function transitionsInYear(year: number, tz: string): Transition[] {
  const out: Transition[] = [];
  const DAY = 86_400_000;
  let t = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  let prev = offsetMinutes(t, tz);
  while (t < end) {
    const next = t + DAY;
    const o = offsetMinutes(next, tz);
    if (o !== prev) {
      let lo = t;
      let hi = next; // offset(lo) = prev, offset(hi) = o
      while (hi - lo > 60_000) {
        const mid = Math.floor((lo + hi) / 2 / 60_000) * 60_000;
        if (mid <= lo) break;
        if (offsetMinutes(mid, tz) === prev) lo = mid;
        else hi = mid;
      }
      out.push({ at: hi, from: prev, to: o });
      prev = o;
    }
    t = next;
  }
  return out;
}

const vtzCache = new Map<string, string[]>();

/** VTIMEZONE lines (no CRLF) for a zone, using the zone's rules in `year`. */
export function vtimezone(tz: string, year: number): string[] {
  const refYear = Math.max(year, 2008);
  const key = `${tz}|${refYear}`;
  const cached = vtzCache.get(key);
  if (cached) return cached;

  const lines = ['BEGIN:VTIMEZONE', `TZID:${tz}`];
  const trans = transitionsInYear(refYear, tz);
  if (trans.length === 0) {
    const off = fmtOffset(offsetMinutes(Date.UTC(refYear, 0, 1), tz));
    lines.push(
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      `TZOFFSETFROM:${off}`,
      `TZOFFSETTO:${off}`,
      'END:STANDARD',
    );
  } else {
    for (const tr of trans) {
      const local = new Date(tr.at + tr.from * 60_000); // wall time just before the change
      const y = local.getUTCFullYear();
      const m0 = local.getUTCMonth();
      const d = local.getUTCDate();
      const dow = local.getUTCDay();
      const nth = d + 7 > daysInMonth(y, m0) ? -1 : Math.ceil(d / 7);
      const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
      lines.push(
        tr.to > tr.from ? 'BEGIN:DAYLIGHT' : 'BEGIN:STANDARD',
        `DTSTART:${compactDate(local)}T${compactTime(mins)}`,
        `RRULE:FREQ=YEARLY;BYMONTH=${m0 + 1};BYDAY=${nth}${WEEKDAY_CODES[dow]}`,
        `TZOFFSETFROM:${fmtOffset(tr.from)}`,
        `TZOFFSETTO:${fmtOffset(tr.to)}`,
        tr.to > tr.from ? 'END:DAYLIGHT' : 'END:STANDARD',
      );
    }
  }
  lines.push('END:VTIMEZONE');
  vtzCache.set(key, lines);
  return lines;
}
