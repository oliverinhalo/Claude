import { noteName, noteWithOctave } from '../lib/music';
import type { Snapshot } from '../lib/useEngine';

/** What the player is hearing back: the big note or chord, and how in tune it is. */
export function Readout({ snap }: { snap: Snapshot }) {
  const { reading, held, sounding, status } = snap;
  const live = status === 'listening' || status === 'demo';

  let main = '—';
  let sub = 'Play a note or a chord.';
  let cents: number | null = null;
  if (held?.reading.kind === 'note') {
    main = noteWithOctave(held.reading.pitch.midi);
    sub = `${Math.round(held.reading.frequency * 10) / 10} Hz`;
  } else if (held?.reading.kind === 'chord') {
    main = held.reading.chord.name;
    sub = `${held.reading.chord.tones.map((t) => noteName(t)).join(' · ')}`;
  }
  if (reading.kind === 'note') {
    cents = reading.pitch.cents;
    sub = `${Math.round(reading.frequency * 10) / 10} Hz`;
  }
  if (!live) {
    main = '—';
    sub = 'Press Listen, or try the demo.';
  } else if (!held) {
    sub =
      reading.kind === 'unclear'
        ? 'Heard something. Let one note ring.'
        : 'Play a note or a chord.';
  }

  const pct = cents === null ? 50 : 50 + Math.max(-50, Math.min(50, cents));
  const inTune = cents !== null && Math.abs(cents) <= 5;

  return (
    <div className="flex flex-col gap-4" data-testid="readout">
      <div className="flex items-baseline gap-4">
        <p
          className={`font-mono text-[length:var(--t-3xl)] leading-none font-semibold tracking-tight transition-opacity duration-[var(--dur-move)] sm:text-6xl ${
            sounding ? 'text-[var(--text)]' : 'text-[var(--text-faint)]'
          }`}
          data-testid="readout-main"
        >
          {main}
        </p>
        <p className="tnum font-mono text-sm text-[var(--text-muted)]">{sub}</p>
      </div>

      <div aria-hidden="true" className="relative h-2 rounded-full bg-[var(--surface-sunken)]">
        <span className="absolute top-[-3px] left-1/2 h-[14px] w-px bg-[var(--border-strong)]" />
        <span
          className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left,opacity] duration-[var(--dur-state)] ${
            inTune ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'
          } ${cents === null ? 'opacity-25' : 'opacity-100'}`}
          style={{ left: `${pct}%` }}
        />
      </div>
      <p className="tnum font-mono text-sm text-[var(--text-muted)]" data-testid="cents">
        {cents === null
          ? 'Tuning needle — waiting for a single note'
          : inTune
            ? 'In tune'
            : `${Math.abs(cents)} cents ${cents > 0 ? 'sharp' : 'flat'}`}
      </p>
    </div>
  );
}
