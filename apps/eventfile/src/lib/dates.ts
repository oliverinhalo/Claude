/** Small wall-clock date helpers. Dates are 'YYYY-MM-DD', times 'HH:MM'. */

export const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d)
    return null;
  if (y < 1970 || y > 2100) return null;
  return dt;
}

export function parseTime(s: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const [h, mi] = [Number(m[1]), Number(m[2])];
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

export const fmtDate = (d: Date): string =>
  `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * 86_400_000);

export const daysInMonth = (y: number, m0: number): number =>
  new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

export const compactDate = (d: Date): string =>
  `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

export const compactTime = (mins: number, secs = 0): string =>
  `${pad(Math.floor(mins / 60))}${pad(mins % 60)}${pad(secs)}`;

export const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
