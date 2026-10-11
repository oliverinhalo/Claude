/**
 * The trainable part: a softmax-regression head over MobileNet embeddings.
 *
 * MobileNet already knows what edges, textures and shapes look like; all that is left
 * to learn is which region of that feature space is "cat" and which is "mug". A linear
 * softmax layer does that in a few hundred full-batch steps — fast enough to watch.
 * Pure TypeScript on purpose: no framework is needed to train it, so it is testable
 * without a browser and costs nothing in the bundle.
 */

export interface Head {
  dim: number;
  labels: string[];
  /** K×D weights, one row per class. */
  weights: number[][];
  bias: number[];
}

export interface TrainingSet {
  /** L2-normalised embeddings. */
  x: Float32Array[];
  /** Class index per embedding. */
  y: number[];
  classes: number;
}

export interface TrainOptions {
  epochs?: number;
  learningRate?: number;
  l2?: number;
  seed?: number;
  onEpoch?: (epoch: number, loss: number) => void;
}

export interface TrainResult {
  head: Omit<Head, 'labels'>;
  loss: number;
  accuracy: number;
}

export interface Prediction {
  index: number;
  probability: number;
}

/** Index into a numeric array; a hole reads as 0 (never happens for in-range indexes). */
const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0;

/** Small deterministic PRNG (mulberry32) so training is reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function l2Normalise(v: ArrayLike<number>): Float32Array {
  const out = new Float32Array(v.length);
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += at(v, i) ** 2;
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < v.length; i++) out[i] = at(v, i) / norm;
  return out;
}

export function softmax(logits: ArrayLike<number>): number[] {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) max = Math.max(max, at(logits, i));
  const exps: number[] = [];
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(at(logits, i) - max);
    exps.push(e);
    sum += e;
  }
  return exps.map((e) => e / sum);
}

function logits(head: Omit<Head, 'labels'>, x: ArrayLike<number>): number[] {
  return head.weights.map((row, k) => {
    let s = at(head.bias, k);
    for (let i = 0; i < head.dim; i++) s += at(row, i) * at(x, i);
    return s;
  });
}

/** Class probabilities for one embedding, most likely first. */
export function predict(
  head: Omit<Head, 'labels'>,
  embedding: ArrayLike<number>,
): Prediction[] {
  const probs = softmax(logits(head, l2Normalise(embedding)));
  return probs
    .map((probability, index) => ({ index, probability }))
    .sort((a, b) => b.probability - a.probability);
}

/** Drives the generator to the end without pausing. */
export function trainHead(set: TrainingSet, options: TrainOptions = {}): TrainResult {
  const run = trainSteps(set, options);
  for (;;) {
    const next = run.next();
    if (next.done) return next.value;
  }
}

/** Same result as `trainHead`, but hands the thread back to the page between batches. */
export async function trainHeadAsync(
  set: TrainingSet,
  options: TrainOptions = {},
): Promise<TrainResult> {
  const run = trainSteps(set, options);
  const started = performance.now();
  let last = started;
  for (;;) {
    const next = run.next();
    if (next.done) return next.value;
    if (performance.now() - last > 30) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      last = performance.now();
    }
  }
}

function* trainSteps(
  set: TrainingSet,
  options: TrainOptions,
): Generator<number, TrainResult, void> {
  const { epochs = 200, learningRate = 4, l2 = 1e-4, seed = 1, onEpoch } = options;
  const n = set.x.length;
  if (n === 0) throw new Error('Nothing to train on.');
  const dim = set.x[0]?.length ?? 0;
  const K = set.classes;
  const random = rng(seed);

  const weights = Array.from({ length: K }, () =>
    Array.from({ length: dim }, () => (random() - 0.5) * 0.02),
  );
  const bias = new Array<number>(K).fill(0);

  // Classes are rarely recorded in equal numbers; weight by inverse frequency so a
  // class with 150 frames does not drown one with 20.
  const counts = new Array<number>(K).fill(0);
  for (const label of set.y) counts[label] = at(counts, label) + 1;
  const classWeight = counts.map((c) => (c === 0 ? 0 : n / (K * c)));

  let loss = 0;
  for (let epoch = 1; epoch <= epochs; epoch++) {
    const gW = weights.map(() => new Float64Array(dim));
    const gB = new Float64Array(K);
    loss = 0;
    for (let s = 0; s < n; s++) {
      const x = set.x[s] ?? new Float32Array(dim);
      const label = at(set.y, s);
      const w = at(classWeight, label);
      const p = softmax(logits({ dim, weights, bias }, x));
      loss -= w * Math.log(Math.max(at(p, label), 1e-12));
      for (let k = 0; k < K; k++) {
        const err = (at(p, k) - (k === label ? 1 : 0)) * w;
        gB[k] = at(gB, k) + err;
        const row = gW[k];
        if (!row) continue;
        for (let i = 0; i < dim; i++) row[i] = at(row, i) + err * at(x, i);
      }
    }
    loss /= n;
    // Plain gradient descent with a gentle decay: the problem is convex, so no tricks.
    const lr = learningRate / (1 + epoch / 150);
    for (let k = 0; k < K; k++) {
      bias[k] = at(bias, k) - (lr * at(gB, k)) / n;
      const row = weights[k];
      const g = gW[k];
      if (!row || !g) continue;
      for (let i = 0; i < dim; i++) row[i] = at(row, i) - lr * (at(g, i) / n + l2 * at(row, i));
    }
    onEpoch?.(epoch, loss);
    yield epoch;
  }

  const head = { dim, weights, bias };
  return { head, loss, accuracy: accuracy(head, set) };
}

export function accuracy(head: Omit<Head, 'labels'>, set: TrainingSet): number {
  if (set.x.length === 0) return 0;
  let right = 0;
  for (let s = 0; s < set.x.length; s++) {
    const x = set.x[s];
    if (x && predict(head, x)[0]?.index === set.y[s]) right++;
  }
  return right / set.x.length;
}
