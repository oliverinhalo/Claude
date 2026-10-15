import { beforeEach, describe, expect, it } from 'vitest';
import {
  datasetStore,
  decodeVector,
  emptyDataset,
  encodeVector,
  exportModel,
  freeClassName,
  importModel,
  loadDataset,
  saveDataset,
  trainBlocker,
  trainable,
  type Dataset,
} from './dataset';
import { l2Normalise, trainHead } from './head';

const vec = (seed: number, dim = 32) =>
  l2Normalise(Float32Array.from({ length: dim }, (_, i) => Math.sin(seed * 31 + i * 1.7)));

function trained(): Dataset {
  const d = emptyDataset();
  d.classes.forEach((c, k) => {
    for (let i = 0; i < 6; i++) c.samples.push(vec(k * 100 + i));
  });
  const x = d.classes.flatMap((c) => c.samples);
  const y = d.classes.flatMap((c, k) => c.samples.map(() => k));
  const { head, accuracy } = trainHead({ x, y, classes: 2 }, { epochs: 20 });
  return {
    ...d,
    head: { ...head, labels: d.classes.map((c) => c.name) },
    trainedOn: 12,
    accuracy,
  };
}

beforeEach(() => localStorage.clear());

describe('vector encoding', () => {
  it('round-trips within 1% of range', () => {
    const v = vec(3, 512);
    const back = decodeVector(encodeVector(v));
    const maxErr = Math.max(...Array.from(v, (x, i) => Math.abs(x - (back[i] ?? 0))));
    expect(maxErr).toBeLessThan(0.01 * 2 * Math.max(...Array.from(v, Math.abs)));
  });
  it('rejects garbage', () => {
    expect(() => decodeVector('!!')).toThrow();
    expect(() => decodeVector(btoa('abc'))).toThrow();
  });
});

describe('train readiness', () => {
  it('is blocked on a fresh dataset, with a reason', () => {
    const d = emptyDataset();
    expect(trainable(d)).toBe(false);
    expect(trainBlocker(d)).toMatch(/at least 5/);
  });
  it('opens once two classes have 5 examples', () => {
    expect(trainBlocker(trained())).toBeNull();
  });
});

describe('persistence', () => {
  it('round-trips a trained dataset', () => {
    const d = trained();
    expect(saveDataset(d)).toBe(true);
    const { dataset, recovered } = loadDataset();
    expect(recovered).toBeNull();
    expect(dataset.classes.map((c) => [c.name, c.samples.length])).toEqual([
      ['Class 1', 6],
      ['Class 2', 6],
    ]);
    expect(dataset.head?.labels).toEqual(['Class 1', 'Class 2']);
  });
  it.each([
    ['not json', '{{{'],
    ['wrong shape', JSON.stringify({ v: 1, d: { classes: 'no' } })],
    [
      'one class',
      JSON.stringify({ v: 1, d: { classes: [{ id: 'a', name: 'a', samples: [] }] } }),
    ],
    ['newer version', JSON.stringify({ v: 9, d: null })],
    [
      'bad sample',
      JSON.stringify({
        v: 1,
        d: {
          classes: [
            { id: 'a', name: 'a', samples: ['@@'] },
            { id: 'b', name: 'b', samples: [] },
          ],
        },
      }),
    ],
  ])('recovers from %s', (_n, raw) => {
    localStorage.setItem(datasetStore.key, raw);
    const { dataset } = loadDataset();
    expect(dataset.classes).toHaveLength(2);
    expect(dataset.classes.every((c) => c.samples.length === 0)).toBe(true);
  });
  it('drops a head whose shape no longer matches', () => {
    const d = trained();
    d.head = d.head && { ...d.head, labels: ['only one'] };
    saveDataset(d);
    expect(loadDataset().dataset.head).toBeNull();
  });
});

describe('model files', () => {
  it('re-imports identically', () => {
    const d = trained();
    const r = importModel(exportModel(d));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.dataset.head).toEqual(d.head);
      expect(r.dataset.classes.map((c) => c.samples.length)).toEqual([6, 6]);
      expect(r.dataset.classes.map((c) => c.id)).toEqual(d.classes.map((c) => c.id));
    }
  });
  it.each([
    '',
    'nope',
    '{}',
    '{"kind":"trainyard-model","version":7}',
    '{"kind":"trainyard-model","version":1}',
  ])('rejects %j with a readable message', (text) => {
    const r = importModel(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.length).toBeGreaterThan(20);
  });
});

describe('freeClassName', () => {
  it('numbers from the count when nothing collides', () => {
    expect(freeClassName(['Class 1', 'Class 2'])).toBe('Class 3');
  });

  it('skips a name left behind by a deleted class', () => {
    expect(freeClassName(['Class 2', 'Class 3'])).toBe('Class 4');
    expect(freeClassName(['Class 2', 'Class 3', 'Class 4'])).toBe('Class 5');
  });

  it('ignores custom names', () => {
    expect(freeClassName(['Cat', 'Dog'])).toBe('Class 3');
  });
});
