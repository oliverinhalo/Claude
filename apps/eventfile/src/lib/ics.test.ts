import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, fileName, fold } from './ics';
import { blankForm, exampleForm, isEventForm, validate, type EventForm } from './model';
import { describeRule, occurrences } from './recur';
import { offsetMinutes, transitionsInYear, vtimezone, wallToUtc } from './timezone';

const NOW = new Date('2026-01-01T00:00:00Z');
const base: EventForm = {
  ...exampleForm(new Date('2026-11-23T12:00:00')),
  title: 'Club night',
  location: '',
  description: '',
  tz: 'Europe/London',
  startDate: '2026-12-03',
  startTime: '19:00',
  endTime: '20:30',
  freq: 'none',
  interval: 1,
  weekdays: [4],
  reminder: null,
  endMode: 'never',
  count: 10,
  until: '',
};
const ics = (o: Partial<EventForm>) =>
  buildIcs({ ...base, ...o }, { now: NOW, uid: 'x@y' }) as string;

describe('text handling', () => {
  it('escapes special characters', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe(String.raw`a\,b\;c\\d\ne`);
  });
  it('folds at 75 octets without splitting characters', () => {
    const lines = fold('SUMMARY:' + 'é'.repeat(100));
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(
      'SUMMARY:' + 'é'.repeat(100),
    );
  });
  it('names files from the title', () => {
    expect(fileName('Café: Ünïcode & Co.')).toBe('cafe-unicode-co.ics');
    expect(fileName('???')).toBe('event.ics');
  });
});

describe('output', () => {
  it('uses CRLF and never exceeds 75 octets', () => {
    const out = ics({ title: 'x'.repeat(400), description: 'y, z'.repeat(80) });
    expect(out.endsWith('\r\n')).toBe(true);
    for (const l of out.split('\r\n'))
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(out.replace(/\r\n/g, '')).not.toContain('\n');
  });
  it('weekly Mon+Wed every 2 weeks', () => {
    expect(ics({ freq: 'weekly', interval: 2, weekdays: [3, 1] })).toContain(
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE',
    );
  });
  it('moves DTSTART to the first selected weekday', () => {
    // 2026-12-03 is a Thursday; Monday selected → Mon 7 Dec
    expect(ics({ freq: 'weekly', weekdays: [1] })).toContain(
      'DTSTART;TZID=Europe/London:20261207T190000',
    );
  });
  it('monthly nth and last weekday', () => {
    expect(ics({ freq: 'monthly', monthlyMode: 'nth', startDate: '2026-12-08' })).toContain(
      'BYDAY=2TU',
    );
    expect(ics({ freq: 'monthly', monthlyMode: 'last', startDate: '2026-12-31' })).toContain(
      'BYDAY=-1TH',
    );
    expect(ics({ freq: 'monthly', monthlyMode: 'day', startDate: '2026-12-08' })).toContain(
      'BYMONTHDAY=8',
    );
  });
  it('count and until', () => {
    expect(ics({ freq: 'daily', endMode: 'count', count: 5 })).toContain('COUNT=5');
    expect(ics({ freq: 'daily', endMode: 'until', until: '2026-12-31' })).toContain(
      'UNTIL=20261231T235959Z',
    );
    expect(
      ics({ freq: 'daily', endMode: 'until', until: '2026-12-31', allDay: true }),
    ).toContain('UNTIL=20261231\r\n');
  });
  it('all-day uses VALUE=DATE with exclusive end', () => {
    const out = ics({ allDay: true });
    expect(out).toContain('DTSTART;VALUE=DATE:20261203');
    expect(out).toContain('DTEND;VALUE=DATE:20261204');
    expect(out).not.toContain('VTIMEZONE');
  });
  it('floating has no TZID', () => {
    const out = ics({ tz: 'floating' });
    expect(out).toContain('DTSTART:20261203T190000');
    expect(out).not.toContain('TZID');
  });
  it('end before start rolls to next day', () => {
    expect(ics({ startTime: '22:00', endTime: '01:00' })).toContain(
      'DTEND;TZID=Europe/London:20261204T010000',
    );
  });
  it('adds a reminder', () => {
    expect(ics({ reminder: 15 })).toContain('TRIGGER:-PT15M');
  });
  it('returns null when invalid', () => {
    expect(ics({ title: '  ' })).toBeNull();
  });
});

describe('time zones', () => {
  it('computes offsets and wall→UTC', () => {
    expect(offsetMinutes(Date.UTC(2026, 6, 1), 'Europe/London')).toBe(60);
    expect(offsetMinutes(Date.UTC(2026, 0, 1), 'Europe/London')).toBe(0);
    expect(new Date(wallToUtc(2026, 6, 1, 12, 0, 'America/New_York')).toISOString()).toBe(
      '2026-07-01T16:00:00.000Z',
    );
  });
  it('finds London transitions on the last Sundays', () => {
    const t = transitionsInYear(2026, 'Europe/London');
    expect(t.map((x) => new Date(x.at).toISOString())).toEqual([
      '2026-03-29T01:00:00.000Z',
      '2026-10-25T01:00:00.000Z',
    ]);
  });
  it('emits rule-based VTIMEZONE for London and New York', () => {
    const lon = vtimezone('Europe/London', 2026).join('\n');
    expect(lon).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU');
    expect(lon).toContain('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU');
    expect(lon).toContain('TZOFFSETTO:+0100');
    const ny = vtimezone('America/New_York', 2026).join('\n');
    expect(ny).toContain('BYMONTH=3;BYDAY=2SU');
    expect(ny).toContain('BYMONTH=11;BYDAY=1SU');
    expect(ny).toContain('TZOFFSETTO:-0400');
  });
  it('single STANDARD for zones without DST', () => {
    const t = vtimezone('Asia/Kolkata', 2026).join('\n');
    expect(t).toContain('TZOFFSETTO:+0530');
    expect(t).not.toContain('DAYLIGHT');
  });
  it('southern hemisphere', () => {
    const t = vtimezone('Australia/Sydney', 2026).join('\n');
    expect(t).toContain('BEGIN:DAYLIGHT');
    expect(t).toContain('BYMONTH=10;BYDAY=1SU');
  });
});

describe('occurrences', () => {
  it('weekly interval 2', () => {
    expect(occurrences({ ...base, freq: 'weekly', interval: 2, weekdays: [4] }, 3)).toEqual([
      '2026-12-03',
      '2026-12-17',
      '2026-12-31',
    ]);
  });
  it('weekly interval counts from the shifted first weekday, not the original start week', () => {
    // Thu 2026-12-03 start, Mon+Wed every 2 weeks: first is Mon 7 Dec, then Wed 9 Dec, then 21 Dec.
    expect(occurrences({ ...base, freq: 'weekly', interval: 2, weekdays: [1, 3] }, 3)).toEqual([
      '2026-12-07',
      '2026-12-09',
      '2026-12-21',
    ]);
  });
  it('rejects NaN and fractional interval/count, and an until with no occurrence', () => {
    const fields = (o: Partial<EventForm>) =>
      validate({ ...base, freq: 'weekly', ...o }).map((e) => e.field);
    expect(fields({ interval: NaN })).toContain('interval');
    expect(fields({ interval: 1.5 })).toContain('interval');
    expect(fields({ endMode: 'count', count: NaN })).toContain('count');
    expect(fields({ endMode: 'count', count: 2.5 })).toContain('count');
    expect(fields({ weekdays: [1], endMode: 'until', until: '2026-12-04' })).toContain('until');
  });
  it('count caps results', () => {
    expect(
      occurrences({ ...base, freq: 'daily', endMode: 'count', count: 2 }, 10),
    ).toHaveLength(2);
  });
  it('until caps results', () => {
    expect(
      occurrences({ ...base, freq: 'daily', endMode: 'until', until: '2026-12-05' }, 10),
    ).toHaveLength(3);
  });
  it('monthly on the 31st skips short months', () => {
    expect(occurrences({ ...base, freq: 'monthly', startDate: '2026-01-31' }, 3)).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
    ]);
  });
  it('yearly', () => {
    expect(occurrences({ ...base, freq: 'yearly', startDate: '2026-02-14' }, 2)).toEqual([
      '2026-02-14',
      '2027-02-14',
    ]);
  });
  it('describes the rule', () => {
    expect(describeRule({ ...base, freq: 'weekly', interval: 2, weekdays: [4, 1] })).toBe(
      'Every 2 weeks on Monday, Thursday.',
    );
  });
});

describe('validation and storage shape', () => {
  it('flags problems by field', () => {
    const f = {
      ...base,
      title: '',
      startDate: '2026-02-31',
      freq: 'weekly' as const,
      weekdays: [],
    };
    expect(validate(f).map((e) => e.field)).toEqual(['title', 'startDate', 'weekdays']);
    expect(
      validate({ ...base, freq: 'daily', endMode: 'until', until: '2026-01-01' })[0]?.field,
    ).toBe('until');
    expect(validate({ ...base, freq: 'daily', endMode: 'count', count: 0 })[0]?.field).toBe(
      'count',
    );
  });
  it('accepts a good form and rejects junk', () => {
    expect(isEventForm(base)).toBe(true);
    expect(isEventForm({ ...base, freq: 'hourly' })).toBe(false);
    expect(isEventForm(null)).toBe(false);
    expect(isEventForm({ ...base, interval: NaN })).toBe(false);
  });
  it('blank keeps zone and date', () => {
    expect(blankForm(base).tz).toBe('Europe/London');
  });
});
