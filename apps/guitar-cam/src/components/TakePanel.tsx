import { useEffect, useState } from 'react';
import { buildExport, toAsciiTab, MAX_BPM, MIN_BPM, type ExportFormat } from '../lib/export';
import type { Take } from '../lib/take';

interface Props {
  take: Take | null;
  recording: boolean;
  canRecord: boolean;
  bpm: number;
  onBpm: (n: number) => void;
  onRecord: () => void;
  onClear: () => void;
}

const FORMATS: ReadonlyArray<{ id: ExportFormat; label: string; hint: string }> = [
  { id: 'musicxml', label: 'MusicXML', hint: 'Guitar Pro, MuseScore, TuxGuitar' },
  { id: 'midi', label: 'MIDI', hint: 'Any DAW or notation app' },
  { id: 'tab', label: 'Text tab', hint: 'Paste anywhere' },
  { id: 'json', label: 'JSON', hint: 'Re-import later' },
];

function download(take: Take, format: ExportFormat, bpm: number) {
  const file = buildExport(format, take, bpm);
  const blob = new Blob([file.data], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 text-sm font-medium text-[var(--text)] transition-colors duration-[var(--dur-state)] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50';

export function TakePanel({
  take,
  recording,
  canRecord,
  bpm,
  onBpm,
  onRecord,
  onClear,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(String(bpm));
  useEffect(() => setDraft(String(bpm)), [bpm]);
  const events = take?.events ?? [];
  const tab = take ? toAsciiTab(take, bpm) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tab);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onRecord}
          disabled={!canRecord && !recording}
          aria-pressed={recording}
          className={`${button} ${recording ? 'border-[var(--danger)] text-[var(--danger)]' : ''}`}
        >
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-full bg-[var(--danger)] ${recording ? 'animate-pulse' : ''}`}
          />
          {recording ? 'Stop recording' : 'Record'}
        </button>
        <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          Tempo
          <input
            type="number"
            inputMode="numeric"
            min={MIN_BPM}
            max={MAX_BPM}
            value={draft}
            onChange={(e) => {
              // Let people type "132" without "1" being clamped to 40 on the way.
              setDraft(e.target.value);
              const n = e.target.valueAsNumber;
              if (Number.isInteger(n) && n >= MIN_BPM && n <= MAX_BPM) onBpm(n);
            }}
            onBlur={() => {
              const n = Number(draft);
              onBpm(draft === '' ? bpm : n);
              setDraft(
                String(
                  draft === '' ? bpm : Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n))),
                ),
              );
            }}
            className="tnum min-h-11 w-20 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2 font-mono text-[var(--text)]"
          />
          BPM
        </label>
        {take && !recording && (
          <button type="button" onClick={onClear} className={`${button} ml-auto`}>
            Clear take
          </button>
        )}
      </div>

      {!canRecord && !recording && (
        <p className="text-sm text-[var(--text-muted)]">
          Start listening or the demo, then press Record to capture what you play.
        </p>
      )}

      <div aria-live="polite" className="text-sm text-[var(--text-muted)]">
        {recording
          ? `Recording… ${events.length} ${events.length === 1 ? 'event' : 'events'} so far.`
          : take
            ? `${events.length} ${events.length === 1 ? 'event' : 'events'} recorded.`
            : ''}
      </div>

      {events.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] p-5 text-[var(--text-muted)]">
          Nothing recorded yet. Press Record, play a phrase, and it appears here as tab, ready
          to export.
        </p>
      ) : (
        <>
          <pre
            tabIndex={0}
            aria-label="Tab of the recorded take"
            className="max-h-72 overflow-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-sunken)] p-4 font-mono text-sm leading-snug text-[var(--text)]"
            data-testid="tab"
          >
            {tab}
          </pre>
          <p className="text-sm text-[var(--text-muted)]">
            Fingerings are inferred from pitch and kept near the previous note; check them
            against your hands before you rely on them.
          </p>
        </>
      )}

      <fieldset className="m-0 border-0 p-0" disabled={events.length === 0 || recording}>
        <legend className="mb-2 text-sm font-medium">Export</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => take && download(take, f.id, bpm)}
              className={`${button} flex-col !items-start !gap-0 py-2 text-left`}
              data-testid={`export-${f.id}`}
            >
              <span>{f.label}</span>
              <span className="text-xs font-normal text-[var(--text-muted)]">{f.hint}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={copy} className={`${button} mt-2`}>
          {copied ? 'Copied' : 'Copy tab to clipboard'}
        </button>
      </fieldset>
    </div>
  );
}
