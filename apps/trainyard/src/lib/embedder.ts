/**
 * Turning a picture into numbers.
 *
 * The rest of the app only knows the `Embedder` interface. The real implementation
 * loads TensorFlow.js and MobileNet from a CDN the first time it is needed — roughly
 * 1 MB of script and 5 MB of weights, cached by the browser after that — so the app
 * itself stays tiny and first paint never waits on a neural network. An audio embedder
 * would be a second implementation of this same interface.
 */
import { l2Normalise } from './head';

export type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export interface Embedder {
  readonly dim: number;
  embed(source: Source): Promise<Float32Array>;
}

interface Tensor {
  data(): Promise<Float32Array>;
  dispose(): void;
}
interface MobileNet {
  infer(img: Source, embedding: true): Tensor;
}
interface TfGlobal {
  ready(): Promise<void>;
  setBackend(name: string): Promise<boolean>;
}
declare global {
  interface Window {
    tf?: TfGlobal;
    mobilenet?: {
      load(config: { version: 1; alpha: number }): Promise<MobileNet>;
    };
  }
}

const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const MOBILENET_URL =
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      el.remove();
      reject(new Error(`Could not download ${new URL(src).pathname.split('/')[3] ?? 'a script'}.`));
    };
    document.head.append(el);
  });
}

export type LoadStage = 'script' | 'weights';

let pending: Promise<Embedder> | null = null;

/** Loads the real embedder once; a failed attempt can be retried. */
export function loadMobileNet(onStage?: (stage: LoadStage) => void): Promise<Embedder> {
  pending ??= (async () => {
    onStage?.('script');
    if (!window.tf) await loadScript(TF_URL);
    if (!window.mobilenet) await loadScript(MOBILENET_URL);
    const { tf, mobilenet } = window;
    if (!tf || !mobilenet) throw new Error('The model library did not start.');
    await tf.ready();
    onStage?.('weights');
    // Alpha 0.5 is the sweet spot: 512-d features, ~5 MB, fast on a phone.
    const net = await mobilenet.load({ version: 1, alpha: 0.5 });
    const dim = 512;
    return {
      dim,
      async embed(source: Source) {
        const t = net.infer(source, true);
        try {
          return l2Normalise(await t.data());
        } finally {
          t.dispose();
        }
      },
    };
  })().catch((e: unknown) => {
    pending = null;
    throw e instanceof Error ? e : new Error('The model could not be loaded.');
  });
  return pending;
}
