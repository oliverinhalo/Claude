import { addDays, daysInMonth, fmtDate, parseDate, WEEKDAY_NAMES } from './dates';
import type { EventForm } from './model';

const DAY = 86_400_000;
const mondayIndex = (d: Date) => (d.getUTCDay() + 6) % 7;

/** nth (1-based) occurrence of this weekday within its month. */
export const nthOfMonth = (d: Date): number => Math.ceil(d.getUTCDate() / 7);
export const isLastOfMonth = (d: Date): boolean =>
  d.getUTCDate() + 7 > daysInMonth(d.getUTCFullYear(), d.getUTCMonth());

/**
 * The first `limit` occurrence dates (YYYY-MM-DD), honouring interval and end rules.
 * For weekly rules the first entry is the first selected weekday on/after the start,
 * which is also what DTSTART must be.
 */
export function occurrences(f: EventForm, limit: number): string[] {
  const start = parseDate(f.startDate);
  if (!start || limit < 1) return [];
  if (f.freq === 'none') return [fmtDate(start)];

  const until = f.endMode === 'until' ? parseDate(f.until) : null;
  const max = f.endMode === 'count' ? Math.min(limit, f.count) : limit;
  const out: string[] = [];
  const interval = Math.max(1, f.interval);
  const weekStart = addDays(start, -mondayIndex(start));
  const anchorNth = nthOfMonth(start);

  const matches = (d: Date): boolean => {
    const days = Math.round((d.getTime() - start.getTime()) / DAY);
    const monthDiff =
      (d.getUTCFullYear() - start.getUTCFullYear()) * 12 + d.getUTCMonth() - start.getUTCMonth();
    switch (f.freq) {
      case 'daily':
        return days % interval === 0;
      case 'weekly': {
        const weeks = Math.floor(Math.round((d.getTime() - weekStart.getTime()) / DAY) / 7);
        return f.weekdays.includes(d.getUTCDay()) && weeks % interval === 0;
      }
      case 'monthly': {
        if (monthDiff % interval !== 0) return false;
        if (f.monthlyMode === 'day') return d.getUTCDate() === start.getUTCDate();
        if (d.getUTCDay() !== start.getUTCDay()) return false;
        return f.monthlyMode === 'nth' ? nthOfMonth(d) === anchorNth : isLastOfMonth(d);
      }
      case 'yearly':
        return (
          monthDiff % (12 * interval) === 0 &&
          d.getUTCMonth() === start.getUTCMonth() &&
          d.getUTCDate() === start.getUTCDate()
        );
      default:
        return false;
    }
  };

  let d = start;
  for (let i = 0; i < 40_000 && out.length < max; i++, d = addDays(d, 1)) {
    if (until && d > until) break;
    if (matches(d)) out.push(fmtDate(d));
  }
  return out;
}

export function describeDate(iso: string): string {
  const d = parseDate(iso);
  if (!d) return iso;
  return `${WEEKDAY_NAMES[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]
  } ${d.getUTCFullYear()}`;
}

const ordinal = (n: number) => ['', 'first', 'second', 'third', 'fourth', 'fifth'][n] ?? `${n}th`;

/** A plain-English reading of the repeat rule. */
export function describeRule(f: EventForm): string {
  const start = parseDate(f.startDate);
  if (f.freq === 'none' || !start) return 'Does not repeat.';
  const n = Math.max(1, f.interval);
  const every = (unit: string, plural: string) => (n === 1 ? `Every ${unit}` : `Every ${n} ${plural}`);
  let s: string;
  switch (f.freq) {
    case 'daily':
      s = every('day', 'days');
      break;
    case 'weekly': {
      const names = [...f.weekdays]
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => WEEKDAY_NAMES[d]);
      s = `${every('week', 'weeks')} on ${names.join(', ') || '…'}`;
      break;
    }
    case 'monthly': {
      const wd = WEEKDAY_NAMES[start.getUTCDay()];
      const where =
        f.monthlyMode === 'day'
          ? `on day ${start.getUTCDate()}`
          : f.monthlyMode === 'nth'
            ? `on the ${ordinal(nthOfMonth(start))} ${wd}`
            : `on the last ${wd}`;
      s = `${every('month', 'months')} ${where}`;
      break;
    }
    default:
      s = every('year', 'years');
  }
  if (f.endMode === 'count') s += `, ${f.count} time${f.count === 1 ? '' : 's'}`;
  else if (f.endMode === 'until' && parseDate(f.until)) s += `, until ${describeDate(f.until)}`;
  return `${s}.`;
}
