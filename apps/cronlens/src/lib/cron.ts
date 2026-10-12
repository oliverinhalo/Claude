/**
 * A five-field crontab parser (minute hour day-of-month month day-of-week).
 *
 * Follows Vixie cron: lists, ranges, steps, month and weekday names, `7` as
 * Sunday, the common `@` macros, and the rule that when both day fields are
 * restricted a day matches if EITHER does.
 */

export interface FieldSpec {
  name: string;
  min: number;
  max: number;
}

const FIELDS: readonly FieldSpec[] = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'day of week', min: 0, max: 7 },
];

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
};

export interface Schedule {
  /** The expression as typed, whitespace-normalised. */
  source: string;
  minutes: number[];
  hours: number[];
  /** Days of the month, 1–31. */
  doms: number[];
  /** Months, 1–12. */
  months: number[];
  /** Weekdays, 0 (Sunday) – 6. */
  dows: number[];
  /** True when the day-of-month field began with `*`. */
  domStar: boolean;
  /** True when the day-of-week field began with `*`. */
  dowStar: boolean;
}

export type ParseResult = { ok: true; schedule: Schedule } | { ok: false; error: string };

const fail = (error: string): ParseResult => ({ ok: false, error });

const clip = (t: string) => (t.length > 16 ? `${t.slice(0, 16)}…` : t);

function parseNumber(token: string, spec: FieldSpec): number | string {
  const upper = token.toUpperCase();
  if (spec.name === 'month') {
    const i = MONTHS.indexOf(upper);
    if (i >= 0) return i + 1;
  }
  if (spec.name === 'day of week') {
    const i = WEEKDAYS.indexOf(upper);
    if (i >= 0) return i;
  }
  if (!/^\d+$/.test(token)) {
    if (/[LW#?]/i.test(token) && !/^[A-Z]{3}$/i.test(token)) {
      return `"${clip(token)}" is Quartz syntax. Cronlens reads standard five-field crontab, which has no L, W, # or ?.`;
    }
    return `"${clip(token)}" is not a number in the ${spec.name} field.`;
  }
  const n = Number(token);
  if (n < spec.min || n > spec.max) {
    return `${clip(token)} is outside the ${spec.name} range ${spec.min}–${spec.max}.`;
  }
  return n;
}

function parseField(text: string, spec: FieldSpec): number[] | string {
  const out = new Set<number>();
  for (const part of text.split(',')) {
    if (part === '') return `The ${spec.name} field has an empty item (a stray comma).`;
    const [range = '', stepText, extra] = part.split('/');
    if (extra !== undefined)
      return `"${clip(part)}" has more than one step in the ${spec.name} field.`;
    let step = 1;
    if (stepText !== undefined) {
      if (!/^\d+$/.test(stepText) || Number(stepText) < 1) {
        return `The step in "${clip(part)}" must be a whole number of at least 1.`;
      }
      step = Number(stepText);
    }
    let lo: number;
    let hi: number;
    if (range === '*') {
      lo = spec.min;
      hi = spec.name === 'day of week' ? 6 : spec.max;
    } else if (range.includes('-')) {
      const [a, b, more] = range.split('-');
      if (more !== undefined || a === undefined || b === undefined) {
        return `"${clip(range)}" is not a valid range in the ${spec.name} field.`;
      }
      const x = parseNumber(a, spec);
      const y = parseNumber(b, spec);
      if (typeof x === 'string') return x;
      if (typeof y === 'string') return y;
      if (x > y)
        return `"${clip(range)}" runs backwards. Write it as two ranges, for example 22-23,0-6.`;
      lo = x;
      hi = y;
    } else {
      const x = parseNumber(range, spec);
      if (typeof x === 'string') return x;
      lo = x;
      hi = stepText !== undefined ? (spec.name === 'day of week' ? 6 : spec.max) : x;
    }
    for (let v = lo; v <= hi; v += step)
      out.add(spec.name === 'day of week' && v === 7 ? 0 : v);
  }
  return [...out].sort((a, b) => a - b);
}

export function parseCron(input: string): ParseResult {
  let text = input.trim().replace(/\s+/g, ' ');
  if (text === '') return fail('Type a cron expression, for example 30 2 * * *.');

  if (text.startsWith('@')) {
    const macro = MACROS[text.toLowerCase()];
    if (macro === undefined) {
      return fail(
        text.toLowerCase() === '@reboot'
          ? '@reboot runs once at boot, so there is no clock to check.'
          : `${clip(text)} is not a macro Cronlens knows. Try @hourly, @daily, @weekly, @monthly or @yearly.`,
      );
    }
    text = macro;
  }

  const parts = text.split(' ');
  if (parts.length === 6 || parts.length === 7) {
    return fail(
      `That has ${parts.length} fields. Standard crontab has five (minute hour day-of-month month day-of-week). If the first one is seconds, drop it.`,
    );
  }
  if (parts.length !== 5) {
    return fail(
      `That has ${parts.length} ${parts.length === 1 ? 'field' : 'fields'}; crontab needs five: minute hour day-of-month month day-of-week.`,
    );
  }

  const parsed: number[][] = [];
  for (const [i, spec] of FIELDS.entries()) {
    const result = parseField(parts[i] ?? '', spec);
    if (typeof result === 'string') return fail(result);
    parsed.push(result);
  }
  const [minutes = [], hours = [], doms = [], months = [], dows = []] = parsed;

  return {
    ok: true,
    schedule: {
      source: input.trim().replace(/\s+/g, ' '),
      minutes,
      hours,
      doms,
      months,
      dows,
      domStar: (parts[2] ?? '').startsWith('*'),
      dowStar: (parts[4] ?? '').startsWith('*'),
    },
  };
}

/** Does this calendar day match the schedule's day fields? */
export function dayMatches(s: Schedule, year: number, month: number, day: number): boolean {
  if (!s.months.includes(month)) return false;
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const domOk = s.doms.includes(day);
  const dowOk = s.dows.includes(dow);
  if (s.domStar || s.dowStar) return domOk && dowOk;
  return domOk || dowOk;
}

/** Times of day (minutes since midnight) the schedule fires on a matching day. */
export function timesOfDay(s: Schedule): number[] {
  const out: number[] = [];
  for (const h of s.hours) for (const m of s.minutes) out.push(h * 60 + m);
  return out;
}

/** Does a wall-clock reading (as UTC fields) match the schedule? */
export function wallMatches(s: Schedule, wallMs: number): boolean {
  const d = new Date(wallMs);
  return (
    s.minutes.includes(d.getUTCMinutes()) &&
    s.hours.includes(d.getUTCHours()) &&
    dayMatches(s, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  );
}
