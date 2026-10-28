import { NOTE_NAMES, pitchClass, tuningById, type Tuning } from './music';
import { eventPitches, type TabEvent, type Take } from './take';

export const MIN_BPM = 40;
export const MAX_BPM = 240;

export type ExportFormat = 'musicxml' | 'midi' | 'tab' | 'json';

export interface ExportFile {
  filename: string;
  mime: string;
  data: string | Uint8Array<ArrayBuffer>;
}

/** Milliseconds per sixteenth note at a tempo. */
const stepMs = (bpm: number): number => 60000 / bpm / 4;

interface Slot {
  event: TabEvent;
  start: number;
  length: number;
}

/**
 * Snap events to a sixteenth-note grid, measured from the first note so the take starts
 * on beat one. Overlaps are resolved by ending the earlier event where the next begins.
 */
export function quantize(events: readonly TabEvent[], bpm: number): Slot[] {
  if (events.length === 0) return [];
  const step = stepMs(bpm);
  const origin = (events[0] as TabEvent).t0;
  const sorted = [...events].sort((a, b) => a.t0 - b.t0);
  const out: Slot[] = [];
  for (const event of sorted) {
    const start = Math.round((event.t0 - origin) / step);
    const last = out[out.length - 1];
    if (last && start <= last.start) {
      // Two events landing on one slot: the later one wins the slot.
      if (start === last.start) out.pop();
      else last.length = start - last.start;
    } else if (last) {
      last.length = Math.min(last.length, start - last.start);
    }
    const length = Math.max(1, Math.round((event.t1 - event.t0) / step));
    out.push({ event, start, length });
  }
  return out;
}

const STRING_LABELS_STANDARD = ['e', 'B', 'G', 'D', 'A', 'E'];

function stringLabels(tuning: Tuning): string[] {
  if (tuning.id === 'standard') return STRING_LABELS_STANDARD;
  return [...tuning.strings].reverse().map((m) => NOTE_NAMES[pitchClass(m)] as string);
}

/** ASCII tab, wrapped at `width` characters, with the tuning and tempo on top. */
export function toAsciiTab(take: Take, bpm: number, width = 64): string {
  const tuning = tuningById(take.tuning);
  const labels = stringLabels(tuning);
  const pad = Math.max(...labels.map((l) => l.length));
  const header = `Tuning: ${tuning.name.split('  ')[0]}   Tempo: ${bpm} BPM`;
  const slots = quantize(take.events, bpm);
  if (slots.length === 0) return `${header}\n\n(no notes recorded)\n`;

  // One column per event; rests and sustain widen it, capped so long gaps stay readable.
  const columns: string[][] = slots.map((slot, i) => {
    const cells = Array.from({ length: 6 }, () => '');
    for (const n of slot.event.notes) cells[n.string - 1] = String(n.fret);
    const w = Math.max(...cells.map((c) => c.length));
    const next = slots[i + 1];
    const gap = next ? Math.min(6, Math.max(0, next.start - slot.start - 1)) : 0;
    return cells.map((c) => c.padEnd(w, '-') + '-'.repeat(1 + gap));
  });

  const lines: string[] = [header, ''];
  let row: string[][] = [];
  let used = pad + 2;
  const flush = () => {
    if (row.length === 0) return;
    for (let s = 0; s < 6; s++) {
      lines.push(`${(labels[s] as string).padEnd(pad)}|-${row.map((c) => c[s]).join('')}|`);
    }
    lines.push('');
    row = [];
    used = pad + 2;
  };
  for (const col of columns) {
    const w = (col[0] as string).length;
    if (used + w > width) flush();
    row.push(col);
    used += w;
  }
  flush();
  return lines.join('\n');
}

// ─── MusicXML ───────────────────────────────────────────────────────────────

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => XML_ESCAPES[c] as string);

/** [duration in sixteenths, MusicXML type, dotted]. Whole to sixteenth. */
const DURATIONS: ReadonlyArray<readonly [number, string, boolean]> = [
  [16, 'whole', false],
  [12, 'half', true],
  [8, 'half', false],
  [6, 'quarter', true],
  [4, 'quarter', false],
  [3, 'eighth', true],
  [2, 'eighth', false],
  [1, '16th', false],
];

/** Split a span into notatable pieces that never cross a bar line. */
function pieces(start: number, length: number): Array<readonly [number, string, boolean]> {
  const out: Array<readonly [number, string, boolean]> = [];
  let pos = start;
  let left = length;
  while (left > 0) {
    const room = 16 - (pos % 16);
    const budget = Math.min(left, room);
    const fit = DURATIONS.find(([d]) => d <= budget) as readonly [number, string, boolean];
    out.push(fit);
    pos += fit[0];
    left -= fit[0];
  }
  return out;
}

const STEPS: Record<number, [string, number]> = {
  0: ['C', 0],
  1: ['C', 1],
  2: ['D', 0],
  3: ['D', 1],
  4: ['E', 0],
  5: ['F', 0],
  6: ['F', 1],
  7: ['G', 0],
  8: ['G', 1],
  9: ['A', 0],
  10: ['A', 1],
  11: ['B', 0],
};

function pitchXml(midi: number, indent: string): string {
  const [step, alter] = STEPS[pitchClass(midi)] as [string, number];
  const octave = Math.floor(midi / 12) - 1;
  return [
    `${indent}<pitch>`,
    `${indent}  <step>${step}</step>`,
    ...(alter ? [`${indent}  <alter>${alter}</alter>`] : []),
    `${indent}  <octave>${octave}</octave>`,
    `${indent}</pitch>`,
  ].join('\n');
}

type Piece = readonly [number, string, boolean];

function restXml([d, type, dot]: Piece): string[] {
  return [
    '      <note>',
    '        <rest/>',
    `        <duration>${d}</duration>`,
    '        <voice>1</voice>',
    `        <type>${type}</type>`,
    ...(dot ? ['        <dot/>'] : []),
    '      </note>',
  ];
}

function tuningXml(tuning: Tuning): string[] {
  return tuning.strings.flatMap((m, i) => {
    const [step, alter] = STEPS[pitchClass(m)] as [string, number];
    return [
      `          <staff-tuning line="${i + 1}">`,
      `            <tuning-step>${step}</tuning-step>`,
      ...(alter ? [`            <tuning-alter>${alter}</tuning-alter>`] : []),
      `            <tuning-octave>${Math.floor(m / 12) - 1}</tuning-octave>`,
      '          </staff-tuning>',
    ];
  });
}

/** One notated piece of an event. Pieces of the same event are tied across bar lines. */
function noteXml(
  event: TabEvent,
  tuning: Tuning,
  [d, type, dot]: Piece,
  i: number,
  count: number,
) {
  const ordered = [...event.notes].sort((a, b) => b.string - a.string);
  const pitches = eventPitches(event, tuning);
  const lines: string[] = [];
  ordered.forEach((n, k) => {
    lines.push(
      '      <note>',
      ...(k > 0 ? ['        <chord/>'] : []),
      pitchXml(pitches[k] as number, '        '),
      `        <duration>${d}</duration>`,
      ...(i > 0 ? ['        <tie type="stop"/>'] : []),
      ...(i < count - 1 ? ['        <tie type="start"/>'] : []),
      '        <voice>1</voice>',
      `        <type>${type}</type>`,
      ...(dot ? ['        <dot/>'] : []),
      '        <notations>',
      ...(i > 0 ? ['          <tied type="stop"/>'] : []),
      ...(i < count - 1 ? ['          <tied type="start"/>'] : []),
      '          <technical>',
      `            <string>${n.string}</string>`,
      `            <fret>${n.fret}</fret>`,
      '          </technical>',
      '        </notations>',
      '      </note>',
    );
  });
  return lines;
}

export function toMusicXml(take: Take, bpm: number, title = 'Guitar Cam take'): string {
  const tuning = tuningById(take.tuning);
  const slots = quantize(take.events, bpm);

  // Lay everything on the sixteenth grid as notated pieces, then group them into bars.
  const placed: Array<{ at: number; lines: string[] }> = [];
  let cursor = 0;
  for (const slot of slots) {
    if (slot.start > cursor) {
      let at = cursor;
      for (const p of pieces(cursor, slot.start - cursor)) {
        placed.push({ at, lines: restXml(p) });
        at += p[0];
      }
    }
    const parts = pieces(slot.start, slot.length);
    let at = slot.start;
    parts.forEach((p, i) => {
      placed.push({ at, lines: noteXml(slot.event, tuning, p, i, parts.length) });
      at += p[0];
    });
    cursor = slot.start + slot.length;
  }

  // Pad the last bar with rests so every measure is complete.
  if (cursor % 16 !== 0) {
    let at = cursor;
    for (const p of pieces(cursor, 16 - (cursor % 16))) {
      placed.push({ at, lines: restXml(p) });
      at += p[0];
    }
  }

  const bars = Math.max(1, Math.ceil(cursor / 16));
  const header = [
    '      <attributes>',
    '        <divisions>4</divisions>',
    '        <key><fifths>0</fifths></key>',
    '        <time><beats>4</beats><beat-type>4</beat-type></time>',
    '        <clef><sign>TAB</sign><line>5</line></clef>',
    '        <staff-details>',
    '          <staff-lines>6</staff-lines>',
    ...tuningXml(tuning),
    '        </staff-details>',
    '      </attributes>',
    `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`,
  ];
  const measures = Array.from({ length: bars }, (_, b) =>
    [
      `    <measure number="${b + 1}">`,
      ...(b === 0 ? header : []),
      ...placed.filter((f) => Math.floor(f.at / 16) === b).flatMap((f) => f.lines),
      '    </measure>',
    ].join('\n'),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="4.0">',
    `  <work><work-title>${esc(title)}</work-title></work>`,
    '  <identification><encoding><software>Guitar Cam</software></encoding></identification>',
    '  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>',
    '  <part id="P1">',
    measures.join('\n'),
    '  </part>',
    '</score-partwise>',
    '',
  ].join('\n');
}

// ─── Standard MIDI file ─────────────────────────────────────────────────────

const PPQ = 480;

function vlq(value: number): number[] {
  const bytes = [value & 0x7f];
  for (let v = value >> 7; v > 0; v >>= 7) bytes.unshift((v & 0x7f) | 0x80);
  return bytes;
}

const be32 = (n: number): number[] => [
  (n >>> 24) & 255,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
];
const be16 = (n: number): number[] => [(n >> 8) & 255, n & 255];
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0) & 0x7f);

/** Format 0, one track, 480 ticks per quarter. Timing is quantized like the other exports. */
export function toMidi(take: Take, bpm: number): Uint8Array<ArrayBuffer> {
  const tuning = tuningById(take.tuning);
  const slots = quantize(take.events, bpm);
  const tick = PPQ / 4; // one sixteenth

  const track: number[] = [];
  const micros = Math.round(60_000_000 / bpm);
  track.push(0x00, 0xff, 0x51, 0x03, (micros >> 16) & 255, (micros >> 8) & 255, micros & 255);
  const name = ascii('Guitar Cam');
  track.push(0x00, 0xff, 0x03, name.length, ...name);
  track.push(0x00, 0xc0, 25); // acoustic guitar (steel)

  const messages: Array<{ at: number; order: number; bytes: number[] }> = [];
  for (const slot of slots) {
    for (const midi of eventPitches(slot.event, tuning)) {
      messages.push({ at: slot.start * tick, order: 1, bytes: [0x90, midi, 90] });
      messages.push({
        at: (slot.start + slot.length) * tick,
        order: 0,
        bytes: [0x80, midi, 0],
      });
    }
  }
  messages.sort((a, b) => a.at - b.at || a.order - b.order);
  let now = 0;
  for (const m of messages) {
    track.push(...vlq(m.at - now), ...m.bytes);
    now = m.at;
  }
  track.push(0x00, 0xff, 0x2f, 0x00);

  const bytes = [
    ...ascii('MThd'),
    ...be32(6),
    ...be16(0),
    ...be16(1),
    ...be16(PPQ),
    ...ascii('MTrk'),
    ...be32(track.length),
    ...track,
  ];
  return new Uint8Array(bytes);
}

// ─── Packaging ──────────────────────────────────────────────────────────────

export function toJson(take: Take): string {
  return JSON.stringify(take, null, 2) + '\n';
}

export function buildExport(format: ExportFormat, take: Take, bpm: number): ExportFile {
  const stamp = take.createdAt.slice(0, 10);
  const base = `guitar-cam-${stamp}`;
  switch (format) {
    case 'musicxml':
      return {
        filename: `${base}.musicxml`,
        mime: 'application/vnd.recordare.musicxml+xml',
        data: toMusicXml(take, bpm),
      };
    case 'midi':
      return { filename: `${base}.mid`, mime: 'audio/midi', data: toMidi(take, bpm) };
    case 'tab':
      return { filename: `${base}.txt`, mime: 'text/plain', data: toAsciiTab(take, bpm) };
    case 'json':
      return { filename: `${base}.json`, mime: 'application/json', data: toJson(take) };
  }
}
