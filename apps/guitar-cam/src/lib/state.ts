import { createStore } from './storage';
import { TUNINGS } from './music';
import { MAX_BPM, MIN_BPM } from './export';
import { isTake, type Take } from './take';

export interface Saved {
  tuning: string;
  bpm: number;
  take: Take | null;
}

export const DEFAULT_STATE: Saved = { tuning: 'standard', bpm: 90, take: null };

function isSaved(v: unknown): v is Saved {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.tuning === 'string' &&
    TUNINGS.some((t) => t.id === s.tuning) &&
    typeof s.bpm === 'number' &&
    s.bpm >= MIN_BPM &&
    s.bpm <= MAX_BPM &&
    (s.take === null || isTake(s.take))
  );
}

export const store = createStore<Saved>({
  key: 'guitar-cam:state',
  version: 1,
  fallback: DEFAULT_STATE,
  validate: isSaved,
});

export const clampBpm = (n: number): number =>
  Number.isNaN(n) ? DEFAULT_STATE.bpm : Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(n)));
