import type { Schedule } from './cron';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Collapse sorted integers into runs: [1,2,3,5] → [[1,3],[5,5]]. */
function runsOf(values: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const v of values) {
    const last = out[out.length - 1];
    if (last && last[1] === v - 1) last[1] = v;
    else out.push([v, v]);
  }
  return out;
}

function span(values: number[], name: (n: number) => string, joiner: string): string {
  return list(
    runsOf(values).map(([a, b]) =>
      a === b
        ? name(a)
        : b === a + 1
          ? list([name(a), name(b)])
          : `${name(a)} ${joiner} ${name(b)}`,
    ),
  );
}

function everyNth(values: number[], min: number, max: number): number | null {
  if (values.length < 3 || values[0] !== min) return null;
  const step = (values[1] ?? 0) - (values[0] ?? 0);
  for (let i = 1; i < values.length; i++)
    if ((values[i] ?? 0) - (values[i - 1] ?? 0) !== step) return null;
  return (values[values.length - 1] ?? 0) + step > max ? step : null;
}

function timePart(s: Schedule): string {
  const { minutes: m, hours: h } = s;
  const allMin = m.length === 60;
  const allHour = h.length === 24;
  if (allMin && allHour) return 'Every minute';
  const stepM = everyNth(m, 0, 59);
  if (allHour && stepM) return `Every ${stepM} minutes`;
  if (allHour && m.length === 1)
    return m[0] === 0 ? 'Every hour, on the hour' : `At minute ${m[0]} past every hour`;
  const stepH = everyNth(h, 0, 23);
  if (m.length === 1 && stepH) {
    return `At minute ${m[0]} past every ${stepH === 1 ? '' : `${stepH}th `}hour`;
  }
  if (h.length * m.length <= 6) {
    const times: string[] = [];
    for (const hh of h) for (const mm of m) times.push(`${pad(hh)}:${pad(mm)}`);
    return `At ${list(times)}`;
  }
  const minuteText = allMin ? 'every minute' : `minute ${list(m.map(String))}`;
  return `At ${minuteText} past ${allHour ? 'every hour' : `hour ${span(h, String, 'to')}`}`;
}

function dayPart(s: Schedule): string {
  const domAll = s.doms.length === 31;
  const dowAll = s.dows.length === 7;
  const dows = () => span(s.dows, (n) => DAY_NAMES[n] ?? '', 'through');
  const doms = () => `on day ${span(s.doms, String, 'to')} of the month`;
  let out = '';
  if (s.domStar && s.dowStar) out = '';
  else if (s.domStar || s.dowStar) {
    if (!s.dowStar && !dowAll) out = dows();
    else if (!s.domStar && !domAll) out = doms();
  } else {
    out = `${doms()}, or on ${dows()}`;
  }
  const months =
    s.months.length === 12
      ? ''
      : `in ${span(s.months, (n) => MONTH_NAMES[n - 1] ?? '', 'through')}`;
  return [out, months].filter(Boolean).join(', ');
}

/** A plain-English reading, in the style of "At 09:00, Monday through Friday". */
export function describeSchedule(s: Schedule): string {
  const day = dayPart(s);
  const time = timePart(s);
  if (!day) return time === 'Every minute' ? time : `${time}, every day`;
  return `${time}, ${day}`;
}
