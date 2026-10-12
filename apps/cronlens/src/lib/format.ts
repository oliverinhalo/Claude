import { formatOffset } from './zone';

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "02:30" from a wall reading. */
export function formatClock(wall: number): string {
  const d = new Date(wall);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "Sun 9 Mar 2025" from a wall reading. */
export function formatDate(wall: number): string {
  const d = new Date(wall);
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2025-03-09 07:00" in UTC. */
export function formatUtc(instant: number): string {
  const d = new Date(instant);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export const offsetLabel = formatOffset;
