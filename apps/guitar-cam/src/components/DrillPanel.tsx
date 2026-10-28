import { useEffect, useRef, useState } from 'react';
import { describeMiss, judge, pickTarget, type Target } from '../lib/drill';
import type { Tuning } from '../lib/music';
import type { Snapshot } from '../lib/useEngine';

interface Props {
  snap: Snapshot;
  tuning: Tuning;
  onTarget: (target: Target | null, revealed: boolean) => void;
}

/** How long a note must be held to count, so a passing pitch does not. */
const HOLD_MS = 350;

const button =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 text-sm font-medium text-[var(--text)] transition-colors duration-[var(--dur-state)] hover:border-[var(--accent)]';

export function DrillPanel({ snap, tuning, onTarget }: Props) {
  const [target, setTarget] = useState<Target | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState({ right: 0, tried: 0, streak: 0 });
  const attemptKey = useRef('');
  const listening = snap.status === 'listening' || snap.status === 'demo';

  useEffect(() => {
    onTarget(target, revealed);
  }, [target, revealed, onTarget]);
  useEffect(() => () => onTarget(null, false), [onTarget]);

  // A new tuning invalidates the current target.
  useEffect(() => {
    setTarget(null);
    setFeedback('');
  }, [tuning]);

  const held = snap.held;
  useEffect(() => {
    if (!target || !held || held.reading.kind !== 'note' || !snap.sounding) return;
    if (held.reading.kind !== 'note') return;
    const key = `${target.prompt}@${held.t0}`;
    if (attemptKey.current === key) return;
    const timer = setTimeout(() => {
      if (held.reading.kind !== 'note') return;
      attemptKey.current = key;
      const verdict = judge(held.reading.pitch.midi, target);
      if (verdict.kind === 'correct') {
        setScore((s) => ({ right: s.right + 1, tried: s.tried + 1, streak: s.streak + 1 }));
        setFeedback(`Correct — ${target.prompt}. Fret ${target.position.fret}.`);
        setTarget(pickTarget(tuning, target));
        setRevealed(false);
      } else {
        setScore((s) => ({ ...s, tried: s.tried + 1, streak: 0 }));
        setFeedback(describeMiss(verdict));
      }
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [held, snap.sounding, target, tuning]);

  const next = () => {
    setTarget(pickTarget(tuning, target));
    setRevealed(false);
    setFeedback('');
  };

  if (!target) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="max-w-prose text-[var(--text-muted)]">
          Guitar Cam names a note and a string. You find it and play it; the microphone checks
          the pitch and the fretboard shows where it should be.
        </p>
        <button type="button" onClick={next} className={button}>
          Start the drill
        </button>
        {!listening && (
          <p className="text-sm text-[var(--text-muted)]">
            Press Listen first so there is something to check your playing with.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p
        className="text-[length:var(--t-xl)] font-semibold tracking-tight"
        data-testid="drill-prompt"
      >
        Play {target.prompt}
      </p>
      <p
        aria-live="polite"
        className="min-h-6 text-[var(--text-muted)]"
        data-testid="drill-feedback"
      >
        {feedback || (listening ? 'Listening for it…' : 'Press Listen to be checked.')}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setRevealed((r) => !r)} className={button}>
          {revealed ? 'Hide it' : 'Show me where'}
        </button>
        <button type="button" onClick={next} className={button}>
          Skip
        </button>
        <p className="tnum ml-auto font-mono text-sm text-[var(--text-muted)]">
          {score.right}/{score.tried} right · streak {score.streak}
        </p>
      </div>
    </div>
  );
}
