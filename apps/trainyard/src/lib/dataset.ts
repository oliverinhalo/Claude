/**
 * The dataset: named classes, each a list of embeddings.
 *
 * Embeddings are stored as signed 8-bit integers (base64). A 1,024-dimension MobileNet
 * vector is 1.4 kB that way instead of ~10 kB as JSON floats, which is what lets 8
 * classes × 150 examples fit comfortably inside localStorage's 5 MB.
 */
import { createStore } from './storage';
import { l2Normalise, type Head } from './head';

export const MIN_CLASSES = 2;
export const MAX_CLASSES = 8;
export const MAX_SAMPLES = 150;
export const MIN_TO_TRAIN = 5;

export interface ClassData {
  id: string;
  name: string;
  /** L2-normalised embeddings. Not persisted as Float32; see encode/decode. */
  samples: Float32Array[];
}

export interface Dataset {
  classes: ClassData[];
  selectedId: string;
  head: Head | null;
  /** Total samples at the moment the head was trained; drives "out of date". */
  trainedOn: number;
  accuracy: number | null;
}

let counter = 0;
export const newId = (): string => `c${Date.now().toString(36)}${(counter++).toString(36)}`;

export function emptyDataset(): Dataset {
  const classes = [
    { id: newId(), name: 'Class 1', samples: [] },
    { id: newId(), name: 'Class 2', samples: [] },
  ];
  return {
    classes,
    selectedId: classes[0]?.id ?? '',
    head: null,
    trainedOn: 0,
    accuracy: null,
  };
}

export const totalSamples = (d: Dataset): number =>
  d.classes.reduce((n, c) => n + c.samples.length, 0);

export const trainable = (d: Dataset): boolean =>
  d.classes.filter((c) => c.samples.length >= MIN_TO_TRAIN).length >= 2;

/** Why Train is unavailable, or null when it is available. */
export function trainBlocker(d: Dataset): string | null {
  const ready = d.classes.filter((c) => c.samples.length >= MIN_TO_TRAIN).length;
  if (ready >= 2) return null;
  return `Record at least ${MIN_TO_TRAIN} examples for two classes to train (${ready} of 2 ready).`;
}

// ---- encoding ------------------------------------------------------------------

export function encodeVector(v: Float32Array): string {
  // Entries of an L2-normalised vector are within [-1, 1]; scale so the largest
  // magnitude uses the full int8 range, and keep that scale alongside.
  let max = 0;
  for (const x of v) max = Math.max(max, Math.abs(x));
  const scale = max || 1;
  const bytes = new Uint8Array(v.length + 4);
  new DataView(bytes.buffer).setFloat32(0, scale, true);
  for (let i = 0; i < v.length; i++) {
    bytes[i + 4] = Math.round(((v[i] ?? 0) / scale) * 127) & 0xff;
  }
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeVector(s: string): Float32Array {
  const bin = atob(s);
  if (bin.length < 5) throw new Error('vector too short');
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const scale = new DataView(bytes.buffer).getFloat32(0, true);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('bad scale');
  const out = new Float32Array(bytes.length - 4);
  for (let i = 0; i < out.length; i++) {
    const signed = ((bytes[i + 4] ?? 0) << 24) >> 24;
    out[i] = (signed / 127) * scale;
  }
  return l2Normalise(out);
}

// ---- serialisation ---------------------------------------------------------------

interface SerialClass {
  id: string;
  name: string;
  samples: string[];
}
export interface SerialDataset {
  classes: SerialClass[];
  selectedId: string;
  head: Head | null;
  trainedOn: number;
  accuracy: number | null;
}

export function serialise(d: Dataset): SerialDataset {
  return {
    classes: d.classes.map((c) => ({
      id: c.id,
      name: c.name,
      samples: c.samples.map(encodeVector),
    })),
    selectedId: d.selectedId,
    head: d.head,
    trainedOn: d.trainedOn,
    accuracy: d.accuracy,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNumArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n));

function isHead(v: unknown, classes: number): v is Head {
  if (!isObj(v)) return false;
  const { dim, labels, weights, bias } = v;
  return (
    typeof dim === 'number' &&
    dim > 0 &&
    Array.isArray(labels) &&
    labels.length === classes &&
    labels.every((l) => typeof l === 'string') &&
    Array.isArray(weights) &&
    weights.length === classes &&
    weights.every((row) => isNumArray(row) && row.length === dim) &&
    isNumArray(bias) &&
    bias.length === classes
  );
}

/** Strict parse of unknown data. Returns null for anything that is not a valid dataset. */
export function deserialise(value: unknown): Dataset | null {
  if (!isObj(value) || !Array.isArray(value.classes)) return null;
  if (value.classes.length < MIN_CLASSES || value.classes.length > MAX_CLASSES) return null;
  const classes: ClassData[] = [];
  let dim: number | null = null;
  try {
    for (const raw of value.classes) {
      if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string')
        return null;
      if (!Array.isArray(raw.samples) || raw.samples.length > MAX_SAMPLES) return null;
      const samples = raw.samples.map((s) => {
        if (typeof s !== 'string') throw new Error('sample');
        const v = decodeVector(s);
        if (dim === null) dim = v.length;
        if (v.length !== dim) throw new Error('dimension mismatch');
        return v;
      });
      classes.push({ id: raw.id, name: raw.name.slice(0, 40), samples });
    }
  } catch {
    return null;
  }
  if (new Set(classes.map((c) => c.id)).size !== classes.length) return null;
  const selectedId =
    typeof value.selectedId === 'string' && classes.some((c) => c.id === value.selectedId)
      ? value.selectedId
      : (classes[0]?.id ?? '');
  let head: Head | null = null;
  if (value.head !== null && value.head !== undefined) {
    if (!isHead(value.head, classes.length) || (dim !== null && value.head.dim !== dim)) {
      head = null;
    } else {
      head = value.head;
    }
  }
  const trainedOn = head && typeof value.trainedOn === 'number' ? value.trainedOn : 0;
  const acc = typeof value.accuracy === 'number' && head ? value.accuracy : null;
  return { classes, selectedId, head, trainedOn, accuracy: acc };
}

// ---- persistence -----------------------------------------------------------------

export const datasetStore = createStore<SerialDataset | null>({
  key: 'trainyard:state',
  version: 1,
  fallback: null,
  validate: (v): v is SerialDataset | null => v === null || deserialise(v) !== null,
});

export function loadDataset(): { dataset: Dataset; recovered: string | null } {
  const result = datasetStore.load();
  const dataset = result.value ? deserialise(result.value) : null;
  return {
    dataset: dataset ?? emptyDataset(),
    recovered: result.status === 'recovered' ? result.reason : null,
  };
}

/** Returns false when storage refused the write (full, or blocked). */
export const saveDataset = (d: Dataset): boolean => datasetStore.save(serialise(d));

// ---- model file ----------------------------------------------------------------

const FILE_KIND = 'trainyard-model';

export function exportModel(d: Dataset): string {
  return JSON.stringify({ kind: FILE_KIND, version: 1, ...serialise(d) });
}

export type ImportResult = { ok: true; dataset: Dataset } | { ok: false; message: string };

export function importModel(text: string): ImportResult {
  if (text.length > 12_000_000)
    return { ok: false, message: 'That file is too large to be a Trainyard model.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      message: 'That file is not valid JSON, so it cannot be a Trainyard model.',
    };
  }
  if (!isObj(parsed) || parsed.kind !== FILE_KIND) {
    return { ok: false, message: 'That file was not exported from Trainyard.' };
  }
  if (parsed.version !== 1) {
    return { ok: false, message: 'That model comes from a different version of Trainyard.' };
  }
  const dataset = deserialise(parsed);
  if (!dataset) return { ok: false, message: 'That model file is damaged or incomplete.' };
  return { ok: true, dataset };
}
