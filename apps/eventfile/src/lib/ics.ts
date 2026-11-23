import {
  addDays,
  compactDate,
  compactTime,
  parseDate,
  parseTime,
  WEEKDAY_CODES,
} from './dates';
import { FLOATING, validate, type EventForm } from './model';
import { nthOfMonth, occurrences } from './recur';
import { vtimezone, wallToUtc } from './timezone';

const enc = new TextEncoder();

export const escapeText = (s: string): string =>
  s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r\n|\r|\n/g, '\\n');

/** Fold a content line to at most 75 octets per physical line, never splitting a character. */
export function fold(line: string): string[] {
  if (enc.encode(line).length <= 75) return [line];
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = ' ';
      curBytes = 1;
      limit = 75;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out;
}

const utcStamp = (ms: number): string => {
  const d = new Date(ms);
  return `${compactDate(d)}T${compactTime(d.getUTCHours() * 60 + d.getUTCMinutes(), d.getUTCSeconds())}Z`;
};

export function buildRRule(f: EventForm, firstDate: Date): string | null {
  if (f.freq === 'none') return null;
  const parts = [`FREQ=${f.freq.toUpperCase()}`];
  if (f.interval > 1) parts.push(`INTERVAL=${f.interval}`);
  if (f.freq === 'weekly') {
    const order = [1, 2, 3, 4, 5, 6, 0];
    parts.push(
      `BYDAY=${order
        .filter((d) => f.weekdays.includes(d))
        .map((d) => WEEKDAY_CODES[d])
        .join(',')}`,
    );
  } else if (f.freq === 'monthly') {
    const wd = WEEKDAY_CODES[firstDate.getUTCDay()];
    if (f.monthlyMode === 'day') parts.push(`BYMONTHDAY=${firstDate.getUTCDate()}`);
    else if (f.monthlyMode === 'nth') parts.push(`BYDAY=${nthOfMonth(firstDate)}${wd}`);
    else parts.push(`BYDAY=-1${wd}`);
  }
  if (f.endMode === 'count') parts.push(`COUNT=${f.count}`);
  else if (f.endMode === 'until') {
    const u = parseDate(f.until);
    if (u) {
      if (f.allDay) parts.push(`UNTIL=${compactDate(u)}`);
      else if (f.tz === FLOATING) parts.push(`UNTIL=${compactDate(u)}T235959`);
      else
        parts.push(
          `UNTIL=${utcStamp(wallToUtc(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), 23, 59, f.tz) + 59_000)}`,
        );
    }
  }
  return `RRULE:${parts.join(';')}`;
}

export interface BuildOptions {
  now?: Date;
  uid?: string;
}

/** Build the .ics text, or null when the form has validation errors. */
export function buildIcs(f: EventForm, opts: BuildOptions = {}): string | null {
  if (validate(f).length > 0) return null;
  const first = occurrences(f, 1)[0];
  const firstDate = first ? parseDate(first) : null;
  if (!firstDate) return null;

  const now = opts.now ?? new Date();
  const uid = opts.uid ?? `${crypto.randomUUID()}@eventfile`;
  const L: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eventfile//Eventfile 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const timed = !f.allDay;
  const zoned = timed && f.tz !== FLOATING;
  if (zoned) L.push(...vtimezone(f.tz, firstDate.getUTCFullYear()));

  L.push('BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${utcStamp(now.getTime())}`);

  if (timed) {
    const sm = parseTime(f.startTime) as number;
    const em = parseTime(f.endTime) as number;
    const endDate = em > sm ? firstDate : addDays(firstDate, 1);
    const prop = zoned ? `;TZID=${f.tz}` : '';
    L.push(
      `DTSTART${prop}:${compactDate(firstDate)}T${compactTime(sm)}`,
      `DTEND${prop}:${compactDate(endDate)}T${compactTime(em)}`,
    );
  } else {
    L.push(
      `DTSTART;VALUE=DATE:${compactDate(firstDate)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(firstDate, 1))}`,
    );
  }

  const rrule = buildRRule(f, firstDate);
  if (rrule) L.push(rrule);
  L.push(`SUMMARY:${escapeText(f.title.trim())}`);
  if (f.location.trim()) L.push(`LOCATION:${escapeText(f.location.trim())}`);
  if (f.description.trim()) L.push(`DESCRIPTION:${escapeText(f.description.trim())}`);
  if (f.reminder !== null) {
    L.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(f.title.trim())}`,
      `TRIGGER:${f.reminder === 0 ? 'PT0S' : `-PT${f.reminder}M`}`,
      'END:VALARM',
    );
  }
  L.push('END:VEVENT', 'END:VCALENDAR');
  return L.flatMap(fold).join('\r\n') + '\r\n';
}

export function fileName(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'event'}.ics`;
}
