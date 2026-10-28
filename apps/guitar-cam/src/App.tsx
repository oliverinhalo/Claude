import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { Fretboard, type Mark } from './components/Fretboard';
import { Readout } from './components/Readout';
import { TakePanel } from './components/TakePanel';
import { DrillPanel } from './components/DrillPanel';
import { chordPositions, voicingFor } from './lib/chord';
import type { Target } from './lib/drill';
import { TUNINGS, choosePosition, noteName, positionsFor, tuningById } from './lib/music';
import type { FretPosition } from './lib/music';
import { clampBpm, store } from './lib/state';
import { lastPosition, toTabEvent, type RawEvent, type Take } from './lib/take';
import { useEngine } from './lib/useEngine';

type Tab = 'record' | 'drill';

const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] px-5 text-sm font-semibold transition-colors duration-[var(--dur-state)]';

export function App() {
  const [loaded] = useState(() => store.load());
  const [tuningId, setTuningId] = useState(loaded.value.tuning);
  const [bpm, setBpm] = useState(loaded.value.bpm);
  const [take, setTake] = useState<Take | null>(loaded.value.take);
  const [recovered] = useState(loaded.status === 'recovered');
  const [recording, setRecording] = useState(false);
  const [tab, setTab] = useState<Tab>('record');
  const [drill, setDrill] = useState<{ target: Target | null; revealed: boolean }>({
    target: null,
    revealed: false,
  });
  const tuning = tuningById(tuningId);

  const recordingRef = useRef(false);
  const tuningRef = useRef(tuning);
  useEffect(() => {
    tuningRef.current = tuning;
  }, [tuning]);

  const onEvent = useCallback((raw: RawEvent) => {
    if (!recordingRef.current) return;
    setTake((current) => {
      if (!current) return current;
      const event = toTabEvent(raw, tuningRef.current, lastPosition(current.events));
      return event ? { ...current, events: [...current.events, event] } : current;
    });
  }, []);

  const { snap, startMic, startDemo, stop } = useEngine(onEvent);
  const live = snap.status === 'listening' || snap.status === 'demo';

  useEffect(() => {
    store.save({ tuning: tuningId, bpm, take });
  }, [tuningId, bpm, take]);

  const toggleRecord = () => {
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
      return;
    }
    // Starting a take replaces the last one, as a recorder would.
    setTake({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      tuning: tuningId,
      events: [],
    });
    recordingRef.current = true;
    setRecording(true);
  };

  const stopListening = () => {
    // Stopping flushes the note still ringing; it must reach the take before recording ends.
    stop();
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
    }
  };

  // Where the player is on the neck: remembered, so the next note stays nearby.
  const anchor = useRef<FretPosition | null>(null);

  const { marks, description, cents } = useMemo(() => {
    const out: Mark[] = [];
    let text = 'Fretboard, six strings. Nothing is sounding.';
    let c: number | null = null;
    const h = snap.held;
    if (live && h && snap.sounding) {
      if (h.reading.kind === 'note') {
        const midi = h.reading.pitch.midi;
        const primary = choosePosition(midi, tuning, anchor.current);
        for (const p of positionsFor(midi, tuning, 15)) {
          if (primary && p.string === primary.string && p.fret === primary.fret) continue;
          out.push({ position: p, role: 'alt' });
        }
        if (primary) {
          out.push({ position: primary, role: 'primary' });
          text = `Playing ${noteName(midi)} on string ${primary.string}, ${primary.fret === 0 ? 'open' : `fret ${primary.fret}`}.`;
        }
        c = snap.reading.kind === 'note' ? snap.reading.pitch.cents : null;
      } else if (h.reading.kind === 'chord') {
        const chord = h.reading.chord;
        const shape = voicingFor(chord, tuning);
        const inShape = new Set(
          shape?.flatMap((f, i) => (f === null ? [] : [`${6 - i}-${f}`])) ?? [],
        );
        for (const p of chordPositions(chord, tuning, 15)) {
          if (!inShape.has(`${p.string}-${p.fret}`)) out.push({ position: p, role: 'alt' });
        }
        shape?.forEach((f, i) => {
          if (f === null) return;
          const position = { string: 6 - i, fret: f };
          const isRoot = ((tuning.strings[i] as number) + f) % 12 === chord.root;
          out.push({ position, role: isRoot ? 'root' : 'tone' });
        });
        text = `Playing ${chord.name}: ${chord.tones.map((t) => noteName(t)).join(', ')}.`;
      }
    }
    if (tab === 'drill' && drill.target && drill.revealed) {
      out.push({ position: drill.target.position, role: 'target' });
      text += ` Target: string ${drill.target.position.string}, fret ${drill.target.position.fret}.`;
    }
    return { marks: out, description: text, cents: c };
  }, [snap, live, tuning, tab, drill]);

  useEffect(() => {
    const primary = marks.find((m) => m.role === 'primary');
    if (primary) anchor.current = primary.position;
  }, [marks]);

  const onTarget = useCallback((target: Target | null, revealed: boolean) => {
    setDrill({ target, revealed });
  }, []);

  const status =
    snap.status === 'requesting'
      ? 'Waiting for microphone permission…'
      : snap.status === 'listening'
        ? 'Listening to your microphone.'
        : snap.status === 'demo'
          ? 'Playing the demo through the same analyser.'
          : 'Not listening.';

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-5">
          <span className="font-mono text-sm tracking-tight text-[var(--text-muted)]">
            <span aria-hidden="true" className="text-[var(--accent)]">
              ●{' '}
            </span>
            guitar-cam
          </span>
          <ThemeToggle />
        </header>

        <main id="main" className="flex-1 pb-10">
          <h1 className="text-[length:var(--t-2xl)] leading-tight font-semibold tracking-tight text-balance sm:text-[length:var(--t-3xl)]">
            See every note you play, on the fret you played it.
          </h1>
          <p className="mt-3 max-w-prose text-[var(--text-muted)] text-pretty">
            Guitar Cam listens through your microphone, names the note or chord, lights the
            fretboard, and writes what you played as tab you can export.
          </p>

          <section
            aria-labelledby="now"
            className="mt-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-sm)] sm:p-6"
          >
            <h2 id="now" className="sr-only">
              Now playing
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {live ? (
                <button
                  type="button"
                  onClick={stopListening}
                  className={`${button} border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text)] hover:border-[var(--accent)]`}
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void startMic()}
                  disabled={snap.status === 'requesting'}
                  className={`${button} bg-[var(--accent)] text-[var(--accent-text)] hover:brightness-110 disabled:opacity-60`}
                >
                  Listen
                </button>
              )}
              {snap.status !== 'demo' && snap.status !== 'listening' && (
                <button
                  type="button"
                  onClick={startDemo}
                  className={`${button} border border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text)] hover:border-[var(--accent)]`}
                >
                  Try the demo
                </button>
              )}
              <label className="ml-auto flex items-center gap-2 text-sm text-[var(--text-muted)]">
                Tuning
                <select
                  value={tuningId}
                  onChange={(e) => setTuningId(e.target.value)}
                  disabled={recording}
                  className="min-h-11 max-w-[11rem] rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-2 text-[var(--text)] sm:max-w-none"
                >
                  {TUNINGS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p
              aria-live="polite"
              className="mt-3 text-sm text-[var(--text-muted)]"
              data-testid="status"
            >
              {status}
            </p>
            {snap.error && (
              <p
                role="alert"
                className="mt-3 text-sm text-[var(--danger)]"
                data-testid="mic-error"
              >
                {snap.error}
              </p>
            )}

            <div className="mt-6">
              <Readout snap={snap} />
            </div>

            <div className="mt-6">
              <Fretboard
                marks={marks}
                cents={cents}
                strings={tuning.strings}
                label={description}
              />
              <p className="sr-only" aria-live="polite">
                {description}
              </p>
            </div>
          </section>

          <section
            aria-labelledby="work"
            className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-sm)] sm:p-6"
          >
            <h2 id="work" className="sr-only">
              Record, export and practise
            </h2>
            <div
              role="tablist"
              aria-label="Mode"
              className="mb-5 flex gap-1 border-b border-[var(--border)]"
            >
              {(
                [
                  ['record', 'Record & export'],
                  ['drill', 'Fretboard drill'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  id={`tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls={`panel-${id}`}
                  tabIndex={tab === id ? 0 : -1}
                  onClick={() => setTab(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      const next = id === 'record' ? 'drill' : 'record';
                      setTab(next);
                      document.getElementById(`tab-${next}`)?.focus();
                    }
                  }}
                  className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-medium ${
                    tab === id
                      ? 'border-[var(--accent)] text-[var(--text)]'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              role="tabpanel"
              id="panel-record"
              aria-labelledby="tab-record"
              hidden={tab !== 'record'}
            >
              <TakePanel
                take={take}
                recording={recording}
                canRecord={live}
                bpm={bpm}
                onBpm={(n) => setBpm(clampBpm(n))}
                onRecord={toggleRecord}
                onClear={() => setTake(null)}
                onImport={setTake}
              />
            </div>
            <div
              role="tabpanel"
              id="panel-drill"
              aria-labelledby="tab-drill"
              hidden={tab !== 'drill'}
            >
              {tab === 'drill' && (
                <DrillPanel snap={snap} tuning={tuning} onTarget={onTarget} />
              )}
            </div>
          </section>

          {recovered && (
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              Your saved settings could not be read, so Guitar Cam started fresh.
            </p>
          )}

          <section aria-labelledby="how" className="mt-10 grid gap-6 sm:grid-cols-3">
            <h2 id="how" className="sr-only">
              How it works
            </h2>
            {[
              [
                'Single notes',
                'Pitch is read to within a few cents, so you see the string, the fret, and whether you are sharp or flat.',
              ],
              [
                'Chords',
                'A strum is matched against major, minor, seventh, suspended and diminished chords, and lit across the neck.',
              ],
              [
                'Export',
                'MusicXML opens in Guitar Pro, MuseScore and TuxGuitar. MIDI, text tab and JSON are there too.',
              ],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{body}</p>
              </div>
            ))}
          </section>
        </main>

        <footer className="border-t border-[var(--border)] py-6 text-sm text-[var(--text-muted)]">
          <p>
            Audio is analysed on this device and never uploaded. Works offline once loaded.{' '}
            <a
              className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
              href="https://github.com/oliverinhalo/guitar-cam"
            >
              Source
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
