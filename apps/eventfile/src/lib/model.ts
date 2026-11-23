import { parseDate, parseTime } from './dates';
import { isValidZone } from './timezone';

export const FLOATING = 'floating';

export type Freq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type MonthlyMode = 'day' | 'nth' | 'last';
export type EndMode = 'never' | 'count' | 'until';

export interface EventForm {
  title: string;
  location: string;
  description: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endTime: string;
  /** IANA zone name, or FLOATING. */
  tz: string;
  freq: Freq;
  interval: number;
  weekdays: number[];
  monthlyMode: MonthlyMode;
  endMode: EndMode;
  count: number;
  until: string;
  /** Minutes before start, or null for no reminder. */
  reminder: number | null;
}

const FREQS: Freq[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const MODES: MonthlyMode[] = ['day', 'nth', 'last'];
const ENDS: EndMode[] = ['never', 'count', 'until'];

export function isEventForm(v: unknown): v is EventForm {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const str = (k: string) => typeof o[k] === 'string';
  return (
    str('title') &&
    str('location') &&
    str('description') &&
    typeof o.allDay === 'boolean' &&
    str('startDate') &&
    str('startTime') &&
    str('endTime') &&
    str('tz') &&
    FREQS.includes(o.freq as Freq) &&
    Number.isInteger(o.interval) &&
    Array.isArray(o.weekdays) &&
    o.weekdays.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) &&
    MODES.includes(o.monthlyMode as MonthlyMode) &&
    ENDS.includes(o.endMode as EndMode) &&
    Number.isInteger(o.count) &&
    str('until') &&
    (o.reminder === null || (Number.isInteger(o.reminder) && (o.reminder as number) >= 0))
  );
}

export interface FieldError {
  field:
    | 'title'
    | 'startDate'
    | 'startTime'
    | 'endTime'
    | 'tz'
    | 'interval'
    | 'weekdays'
    | 'count'
    | 'until';
  message: string;
}

export const MAX_TITLE = 500;

export function validate(f: EventForm): FieldError[] {
  const errs: FieldError[] = [];
  if (f.title.trim() === '') errs.push({ field: 'title', message: 'Give the event a title.' });
  if (f.title.length > MAX_TITLE)
    errs.push({ field: 'title', message: `Keep the title under ${MAX_TITLE} characters.` });
  const start = parseDate(f.startDate);
  if (!start)
    errs.push({ field: 'startDate', message: 'Enter a valid start date (1970–2100).' });
  if (!f.allDay) {
    if (parseTime(f.startTime) === null)
      errs.push({ field: 'startTime', message: 'Enter a start time like 09:30.' });
    if (parseTime(f.endTime) === null)
      errs.push({ field: 'endTime', message: 'Enter an end time like 10:30.' });
    if (f.tz !== FLOATING && !isValidZone(f.tz))
      errs.push({ field: 'tz', message: 'This browser does not know that time zone.' });
  }
  if (f.freq !== 'none') {
    if (f.interval < 1 || f.interval > 99)
      errs.push({ field: 'interval', message: 'Repeat every 1 to 99.' });
    if (f.freq === 'weekly' && f.weekdays.length === 0)
      errs.push({ field: 'weekdays', message: 'Pick at least one weekday.' });
    if (f.endMode === 'count' && (f.count < 1 || f.count > 999))
      errs.push({ field: 'count', message: 'Number of events must be 1 to 999.' });
    if (f.endMode === 'until') {
      const until = parseDate(f.until);
      if (!until) errs.push({ field: 'until', message: 'Enter a valid end date.' });
      else if (start && until < start)
        errs.push({ field: 'until', message: 'The end date is before the start date.' });
    }
  }
  return errs;
}

export function exampleForm(today: Date = new Date()): EventForm {
  // Next Thursday strictly after today, in the visitor's local calendar.
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  do d.setDate(d.getDate() + 1);
  while (d.getDay() !== 4);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  let tz = FLOATING;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || FLOATING;
  } catch {
    /* keep floating */
  }
  return {
    title: 'Committee meeting',
    location: 'Village hall, back room',
    description: 'Agenda goes out the day before.',
    allDay: false,
    startDate: iso,
    startTime: '19:00',
    endTime: '20:30',
    tz: isValidZone(tz) ? tz : FLOATING,
    freq: 'weekly',
    interval: 2,
    weekdays: [4],
    monthlyMode: 'day',
    endMode: 'never',
    count: 10,
    until: '',
    reminder: 60,
  };
}

export function blankForm(base: EventForm): EventForm {
  return {
    ...base,
    title: '',
    location: '',
    description: '',
    freq: 'none',
    interval: 1,
    reminder: null,
    endMode: 'never',
  };
}
