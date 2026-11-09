import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, fold } from './ics';
import { buildSchedule } from './schedule';
import { decodePlan, encodePlan, isSaved } from './plan-store';

describe('ics', () => {
  const plan = {
    readyAt: Date.UTC(2026, 5, 6, 18, 30),
    method: 'same-day' as const,
    roomTemp: 22,
  };
  const ics = buildIcs(buildSchedule(plan), Date.UTC(2026, 5, 1));
  it('is a well-formed calendar with one event per step', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(8);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(8);
  });
  it('uses UTC timestamps', () => {
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  });
  it('escapes special characters and folds long lines', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    for (const line of fold('x'.repeat(200)).split('\r\n'))
      expect(line.length).toBeLessThanOrEqual(75);
  });
  it('folds by UTF-8 octets without splitting characters', () => {
    const folded = fold('DESCRIPTION:' + '°🍞'.repeat(60));
    const enc = new TextEncoder();
    for (const line of folded.split('\r\n'))
      expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe('DESCRIPTION:' + '°🍞'.repeat(60));
  });
});

describe('plan url state', () => {
  it('round-trips a plan to the minute', () => {
    const plan = {
      readyAt: Date.UTC(2026, 5, 6, 18, 30),
      method: 'overnight' as const,
      roomTemp: 19,
    };
    expect(decodePlan('#' + encodePlan(plan))).toEqual(plan);
  });
  it.each([
    '',
    '#',
    '#t=abc&m=s&c=20',
    '#t=100&m=x&c=20',
    '#t=100&m=s&c=99',
    '#t=-5&m=s&c=20',
    '#t=100&m=s&c=22.5',
  ])('rejects malformed hash %j', (h) => expect(decodePlan(h)).toBeNull());
  it('validates saved state strictly', () => {
    expect(isSaved({ method: 'same-day', roomTemp: 22 })).toBe(true);
    expect(isSaved({ method: 'nope', roomTemp: 22 })).toBe(false);
    expect(isSaved({ method: 'overnight', roomTemp: NaN })).toBe(false);
    expect(isSaved(null)).toBe(false);
  });
});
