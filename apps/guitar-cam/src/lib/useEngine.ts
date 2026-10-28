import { useCallback, useEffect, useRef, useState } from 'react';
import { WINDOW, createAnalyzer, type Reading } from './analyzer';
import { demoWindow } from './demo';
import { Tracker, type Held } from './tracker';
import type { RawEvent } from './take';

export type EngineStatus = 'idle' | 'requesting' | 'listening' | 'demo' | 'error';

export interface Snapshot {
  status: EngineStatus;
  error: string | null;
  /** The latest frame, for the tuning needle. */
  reading: Reading;
  /** The believed note or chord, held until the next one replaces it. */
  held: Held | null;
  /** True while the held sound is still ringing. */
  sounding: boolean;
  /** Input level, 0–1, for the meter. */
  level: number;
}

const IDLE: Snapshot = {
  status: 'idle',
  error: null,
  reading: { kind: 'silence' },
  held: null,
  sounding: false,
  level: 0,
};

/** One analysis pass every ~33 ms: fast enough to feel live, cheap enough for a phone. */
const FRAME_MS = 33;

export function describeMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access was blocked. Allow it for this site in the address bar, then press Listen again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone was found. Connect an audio interface or microphone, then press Listen again.';
  }
  if (name === 'NotReadableError') {
    return 'The microphone is in use by another app. Close it there, then press Listen again.';
  }
  return 'The microphone could not be started. The demo still works.';
}

/**
 * Owns the audio side: the microphone (or the demo), the analyser loop, and the tracker.
 * `onEvent` receives each completed note or chord.
 */
export function useEngine(onEvent: (event: RawEvent) => void) {
  const [snap, setSnap] = useState<Snapshot>(IDLE);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const cleanup = useRef<(() => void) | null>(null);
  // Bumped by every start and stop, so a microphone request that resolves late can tell it
  // has been overtaken and release what it was given instead of replacing the new session.
  const session = useRef(0);
  const tracker = useRef(new Tracker());

  const stop = useCallback(() => {
    session.current += 1;
    cleanup.current?.();
    cleanup.current = null;
    for (const e of tracker.current.flush(performance.now())) onEventRef.current(e);
    setSnap(IDLE);
  }, []);

  useEffect(
    () => () => {
      session.current += 1;
      cleanup.current?.();
    },
    [],
  );

  const run = useCallback(
    (
      status: 'listening' | 'demo',
      read: (t: number) => { samples: Float32Array; rate: number },
    ) => {
      tracker.current = new Tracker();
      const analyze = createAnalyzer();
      const origin = performance.now();
      let last = 0;
      let raf = 0;
      let lastKey = '';
      let lastHeld: Held | null = null;
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (now - last < FRAME_MS) return;
        last = now;
        const { samples, rate } = read(now - origin);
        const reading = analyze(samples, rate, now - origin);
        for (const e of tracker.current.push(now - origin, reading)) onEventRef.current(e);

        let sum = 0;
        for (let i = samples.length - 2048; i < samples.length; i++)
          sum += (samples[i] as number) ** 2;
        const level = Math.min(1, Math.sqrt(sum / 2048) * 6);
        // The tracker rides out the flicker of a decaying string; keep the last thing
        // played on screen, dimmed, rather than blanking the readout between notes.
        const active = tracker.current.held;
        if (active) lastHeld = active;
        const held = active ?? lastHeld;
        const sounding = active !== null;
        // Re-render only when something visible changed.
        const key = [
          reading.kind,
          reading.kind === 'note'
            ? `${reading.pitch.midi}:${Math.round(reading.pitch.cents / 3)}`
            : '',
          reading.kind === 'chord' ? reading.chord.name : '',
          held ? `${held.t0}` : '',
          sounding,
          Math.round(level * 20),
        ].join('|');
        if (key === lastKey) return;
        lastKey = key;
        setSnap({ status, error: null, reading, held, sounding, level });
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    },
    [],
  );

  const startDemo = useCallback(() => {
    session.current += 1;
    cleanup.current?.();
    const rate = 44100;
    const dispose = run('demo', (t) => ({ samples: demoWindow(t, rate, WINDOW), rate }));
    cleanup.current = dispose;
    setSnap({ ...IDLE, status: 'demo' });
  }, [run]);

  const startMic = useCallback(async () => {
    cleanup.current?.();
    cleanup.current = null;
    const mine = ++session.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setSnap({
        ...IDLE,
        status: 'error',
        error:
          'This browser cannot reach a microphone here. Microphone access needs a secure (https) page in a current browser. The demo still works.',
      });
      return;
    }
    setSnap({ ...IDLE, status: 'requesting' });
    let stream: MediaStream;
    try {
      // A guitar wants none of the voice processing browsers apply by default.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      if (session.current === mine) {
        setSnap({ ...IDLE, status: 'error', error: describeMicError(err) });
      }
      return;
    }
    if (session.current !== mine) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = WINDOW;
    analyser.smoothingTimeConstant = 0;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    const stopLoop = run('listening', () => {
      analyser.getFloatTimeDomainData(buffer);
      return { samples: buffer, rate: ctx.sampleRate };
    });
    cleanup.current = () => {
      stopLoop();
      for (const track of stream.getTracks()) track.stop();
      void ctx.close();
    };
    // Someone unplugging the interface should not leave a frozen "listening" state.
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      cleanup.current?.();
      cleanup.current = null;
      setSnap({
        ...IDLE,
        status: 'error',
        error: 'The microphone was disconnected. Reconnect it and press Listen.',
      });
    });
    void ctx.resume();
  }, [run]);

  return { snap, startMic, startDemo, stop };
}
