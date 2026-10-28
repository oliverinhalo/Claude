import { must } from '../test-helpers';
import { describe, expect, it } from 'vitest';
import { buildExport, quantize, toAsciiTab, toJson, toMidi, toMusicXml } from './export';
import { isTake, parseTake, toTabEvent, type Take, type TabEvent } from './take';
import { DEFAULT_TUNING } from './music';

const ev = (t0: number, t1: number, label: string, notes: [number, number][]): TabEvent => ({
  t0,
  t1,
  label,
  inferred: true,
  notes: notes.map(([string, fret]) => ({ string, fret })),
});

// 120 BPM → a sixteenth is 125 ms.
const take: Take = {
  id: 't1',
  createdAt: '2026-10-28T10:00:00.000Z',
  tuning: 'standard',
  events: [
    ev(1000, 1500, 'E2', [[6, 0]]),
    ev(1500, 2000, 'G2', [[6, 3]]),
    ev(2250, 3250, 'Em', [
      [6, 0],
      [5, 2],
      [4, 2],
    ]),
  ],
};

describe('quantize', () => {
  it('starts the take on beat one and snaps to sixteenths', () => {
    const slots = quantize(take.events, 120);
    expect(slots.map((s) => [s.start, s.length])).toEqual([
      [0, 4],
      [4, 4],
      [10, 8],
    ]);
  });
  it('never lets one event run into the next', () => {
    const slots = quantize([ev(0, 1000, 'A', [[1, 0]]), ev(250, 400, 'B', [[1, 1]])], 120);
    expect(slots[0]).toMatchObject({ start: 0, length: 2 });
  });
});

describe('ASCII tab', () => {
  const tab = toAsciiTab(take, 120);
  const lines = tab.split('\n').filter((l) => /^[eBGDAE]\|/.test(l));
  it('has six lines, aligned', () => {
    expect(lines).toHaveLength(6);
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
  });
  it('puts frets on the right strings', () => {
    expect(lines[5]).toMatch(/^E\|-0-+3-+0/);
    expect(lines[4]).toContain('2');
    expect(lines[0]).not.toMatch(/\d/);
  });
  it('says so when nothing was recorded', () => {
    expect(toAsciiTab({ ...take, events: [] }, 120)).toContain('no notes recorded');
  });
  it('wraps long takes without breaking alignment', () => {
    const long = {
      ...take,
      events: Array.from({ length: 60 }, (_, i) =>
        ev(i * 500, i * 500 + 400, 'A', [[5, i % 10]]),
      ),
    };
    const rows = toAsciiTab(long, 120, 48)
      .split('\n')
      .filter((l) => /^[eBGDAE]\|/.test(l));
    expect(rows.length).toBeGreaterThan(6);
    expect(rows.every((r) => r.length <= 48 + 2)).toBe(true);
  });
});

describe('MusicXML', () => {
  const xml = toMusicXml(take, 120);
  it('is well formed', () => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.tagName).toBe('score-partwise');
  });
  it('carries a string and fret for every note, and pitches that agree', () => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const notes = [...doc.querySelectorAll('note')].filter((n) => !n.querySelector('rest'));
    expect(notes).toHaveLength(8); // E2, G2, and a three-note chord split by a tie at the bar line
    for (const n of notes) {
      expect(n.querySelector('string')).not.toBeNull();
      expect(n.querySelector('fret')).not.toBeNull();
    }
    const first = must(notes[0]);
    expect(first.querySelector('step')?.textContent).toBe('E');
    expect(first.querySelector('octave')?.textContent).toBe('2');
    expect(must(notes[2]).querySelector('fret')?.textContent).toBe('0');
    expect(must(notes[3]).querySelector('chord')).not.toBeNull();
  });
  it('fills every measure exactly', () => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    for (const m of doc.querySelectorAll('measure')) {
      const total = [...m.querySelectorAll(':scope > note')]
        .filter((n) => !n.querySelector('chord'))
        .reduce((sum, n) => sum + Number(n.querySelector('duration')?.textContent), 0);
      expect(total).toBe(16);
    }
  });
  it('ties a note that crosses a bar line', () => {
    const long = { ...take, events: [ev(0, 3000, 'A2', [[5, 0]])] }; // 24 sixteenths
    const doc = new DOMParser().parseFromString(toMusicXml(long, 120), 'application/xml');
    expect(doc.querySelectorAll('measure')).toHaveLength(2);
    expect(doc.querySelectorAll('tie[type="start"]').length).toBeGreaterThan(0);
    expect(doc.querySelectorAll('tie[type="stop"]').length).toBeGreaterThan(0);
  });
  it('escapes the title', () => {
    expect(toMusicXml(take, 120, 'A & <B>')).toContain('A &amp; &lt;B&gt;');
  });
  it('produces a valid empty score', () => {
    const doc = new DOMParser().parseFromString(
      toMusicXml({ ...take, events: [] }, 120),
      'application/xml',
    );
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelectorAll('measure')).toHaveLength(1);
  });
});

describe('MIDI', () => {
  const bytes = toMidi(take, 120);
  const text = (from: number, n: number) => String.fromCharCode(...bytes.slice(from, from + n));
  it('has a Type-0 header at 480 ppq and a track chunk', () => {
    expect(text(0, 4)).toBe('MThd');
    expect([...bytes.slice(8, 14)]).toEqual([0, 0, 0, 1, 1, 0xe0]);
    expect(text(14, 4)).toBe('MTrk');
    const len =
      (must(bytes[18]) << 24) |
      (must(bytes[19]) << 16) |
      (must(bytes[20]) << 8) |
      must(bytes[21]);
    expect(bytes.length).toBe(22 + len);
  });
  it('encodes 120 BPM as 500000 µs per quarter', () => {
    const at = bytes.findIndex((b, i) => b === 0xff && bytes[i + 1] === 0x51);
    expect([...bytes.slice(at + 3, at + 6)]).toEqual([0x07, 0xa1, 0x20]);
  });
  it('plays E2 (40), G2 (43), then E, B, E for the chord', () => {
    const ons: number[] = [];
    for (let i = 22; i < bytes.length - 2; i++) {
      if (bytes[i] === 0x90 && bytes[i + 2] === 90) ons.push(must(bytes[i + 1]));
    }
    expect(ons).toEqual([40, 43, 40, 47, 52]);
  });
  it('ends with end-of-track', () => {
    expect([...bytes.slice(-3)]).toEqual([0xff, 0x2f, 0x00]);
  });
});

describe('JSON and packaging', () => {
  it('round-trips a take', () => {
    expect(parseTake(toJson(take))).toEqual(take);
  });
  it('rejects a damaged take', () => {
    expect(parseTake('{"id":1}')).toBeNull();
    expect(parseTake('not json')).toBeNull();
    expect(
      isTake({ ...take, events: [{ ...take.events[0], notes: [{ string: 9, fret: 0 }] }] }),
    ).toBe(false);
  });
  it('names files by date with the right extension', () => {
    expect(buildExport('musicxml', take, 120).filename).toBe('guitar-cam-2026-10-28.musicxml');
    expect(buildExport('midi', take, 120).filename).toMatch(/\.mid$/);
    expect(buildExport('tab', take, 120).mime).toBe('text/plain');
  });
});

describe('toTabEvent', () => {
  it('keeps a melody near the previous position', () => {
    const first = must(
      toTabEvent({ kind: 'note', t0: 0, t1: 200, midi: 64 }, DEFAULT_TUNING, null),
    );
    expect(first.notes[0]).toEqual({ string: 1, fret: 0 });
    const second = must(
      toTabEvent(
        { kind: 'note', t0: 200, t1: 400, midi: 67 },
        DEFAULT_TUNING,
        must(first.notes[0]),
      ),
    );
    expect(second.notes[0]).toEqual({ string: 1, fret: 3 });
  });
});
