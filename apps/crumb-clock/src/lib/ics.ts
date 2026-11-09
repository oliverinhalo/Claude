import type { Step } from './schedule';
import { MINUTE } from './schedule';

const fmt = (ms: number): string =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** Escape text per RFC 5545 §3.3.11. */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (approximated by characters). */
export function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(' ' + line.slice(i, i + 74));
  return parts.join('\r\n');
}

/** Build an iCalendar file with one event and a 5-minute-early alarm per step. */
export function buildIcs(steps: Step[], stamp: number): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Crumb Clock//EN',
    'CALSCALE:GREGORIAN',
  ];
  for (const s of steps) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.id}-${s.at}@crumb-clock`,
      `DTSTAMP:${fmt(stamp)}`,
      `DTSTART:${fmt(s.at)}`,
      `DTEND:${fmt(s.at + s.minutes * MINUTE)}`,
      `SUMMARY:${escapeText('🍞 ' + s.title)}`,
      `DESCRIPTION:${escapeText(s.detail)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(s.title)}`,
      'TRIGGER:-PT5M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
