import { describe, expect, it } from 'vitest';
import { l2Normalise, predict, softmax, trainHead, type TrainingSet } from './head';

/** Three clusters in 16-d, each around its own axis, with seeded noise. */
function clusters(perClass = 20, seed = 7): TrainingSet {
  let s = seed;
  const noise = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296 - 0.5) * 0.4;
  };
  const x: Float32Array[] = [];
  const y: number[] = [];
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < perClass; i++) {
      const v = new Float32Array(16).map(() => noise());
      v[k * 4] = (v[k * 4] ?? 0) + 1;
      x.push(l2Normalise(v));
      y.push(k);
    }
  }
  return { x, y, classes: 3 };
}

describe('trainHead', () => {
  it('separates linearly separable clusters (>= 95%)', () => {
    const { accuracy } = trainHead(clusters());
    expect(accuracy).toBeGreaterThanOrEqual(0.95);
  });

  it('is deterministic for a fixed seed', () => {
    const a = trainHead(clusters(), { epochs: 40, seed: 3 });
    const b = trainHead(clusters(), { epochs: 40, seed: 3 });
    expect(a.head.weights).toEqual(b.head.weights);
  });

  it('reports every epoch and lowers the loss', () => {
    const losses: number[] = [];
    trainHead(clusters(), { epochs: 30, onEpoch: (_e, l) => losses.push(l) });
    expect(losses).toHaveLength(30);
    expect(losses.at(-1) ?? Infinity).toBeLessThan(losses[0] ?? 0);
  });

  it('still learns when one class has far fewer examples', () => {
    const set = clusters(30);
    const keep = set.y.map((k, i) => (k !== 2 || i % 6 === 0 ? i : -1)).filter((i) => i >= 0);
    const small: TrainingSet = {
      x: keep.map((i) => set.x[i] ?? new Float32Array(16)),
      y: keep.map((i) => set.y[i] ?? 0),
      classes: 3,
    };
    const { head } = trainHead(small);
    expect(predict(head, set.x[set.y.lastIndexOf(2)] ?? [])[0]?.index).toBe(2);
  });

  it('refuses an empty set', () => {
    expect(() => trainHead({ x: [], y: [], classes: 2 })).toThrow();
  });
});

describe('predict', () => {
  it('returns a descending probability distribution summing to 1', () => {
    const { head } = trainHead(clusters(), { epochs: 20 });
    const out = predict(head, clusters().x[0] ?? []);
    expect(out.reduce((n, p) => n + p.probability, 0)).toBeCloseTo(1, 6);
    expect(out.every((p) => p.probability >= 0)).toBe(true);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]?.probability ?? 0).toBeGreaterThanOrEqual(out[i]?.probability ?? 1);
    }
  });

  it('softmax does not overflow on huge logits', () => {
    const p = softmax([1000, 0, -1000]);
    expect(p[0]).toBeCloseTo(1, 9);
    expect(p.every(Number.isFinite)).toBe(true);
  });
});
