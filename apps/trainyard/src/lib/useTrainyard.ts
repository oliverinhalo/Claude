import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_CLASSES,
  MAX_SAMPLES,
  MIN_CLASSES,
  emptyDataset,
  exportModel,
  freeClassName,
  importModel,
  loadDataset,
  newId,
  saveDataset,
  trainBlocker,
  type Dataset,
} from './dataset';
import { loadMobileNet, type Embedder, type LoadStage, type Source } from './embedder';
import { predict, trainHeadAsync, type Prediction } from './head';

export type Engine =
  | { status: 'idle' }
  | { status: 'loading'; stage: LoadStage }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export type CameraState =
  | { status: 'off' }
  | { status: 'starting' }
  | { status: 'on' }
  | { status: 'error'; message: string };

const TICK_MS = 120;
const THUMB = 56;
const THUMBS_KEPT = 12;

function thumbnail(source: Source): string {
  const c = document.createElement('canvas');
  c.width = c.height = THUMB;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const w = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
  const h = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
  const side = Math.min(w, h) || THUMB;
  ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, THUMB, THUMB);
  return c.toDataURL('image/jpeg', 0.6);
}

function cameraMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera access was blocked. Allow it in your browser’s address bar, or add images from files instead.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'No camera was found on this device. You can still add images from files.';
  if (name === 'NotReadableError')
    return 'The camera is busy in another app. Close it there and try again.';
  return 'The camera could not be started. You can still add images from files.';
}

export function useTrainyard() {
  const [initial] = useState(loadDataset);
  const [dataset, setDataset] = useState<Dataset>(initial.dataset);
  const [notice, setNotice] = useState<string | null>(
    initial.recovered ? 'Saved data could not be read, so Trainyard started fresh.' : null,
  );
  const [engine, setEngine] = useState<Engine>({ status: 'idle' });
  const [camera, setCamera] = useState<CameraState>({ status: 'off' });
  const [recording, setRecording] = useState(false);
  const [training, setTraining] = useState<{ epoch: number; epochs: number } | null>(null);
  const [predictions, setPredictions] = useState<Prediction[] | null>(null);
  const [tested, setTested] = useState<{ name: string; thumb: string } | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string[]>>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const embedderRef = useRef<Embedder | null>(null);
  const live = useRef({ dataset, recording });
  live.current = { dataset, recording };

  // Persist, debounced; a refused write is a notice, never a crash.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!saveDataset(dataset)) {
        setNotice(
          'Your browser would not save this work (storage is full or blocked). It stays until you close the tab — use Export to keep it.',
        );
      }
    }, 400);
    return () => clearTimeout(t);
  }, [dataset]);

  // Closing or reloading the tab inside the debounce window must not lose the last edit.
  useEffect(() => {
    const flush = () => saveDataset(live.current.dataset);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const ensureEmbedder = useCallback(async (): Promise<Embedder | null> => {
    if (embedderRef.current) return embedderRef.current;
    setEngine({ status: 'loading', stage: 'script' });
    try {
      const e = await loadMobileNet((stage) => setEngine({ status: 'loading', stage }));
      embedderRef.current = e;
      setEngine({ status: 'ready' });
      return e;
    } catch (err) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      setEngine({
        status: 'error',
        message: offline
          ? 'You are offline, and the model has not been downloaded on this device yet. Connect once and try again — after that it is cached.'
          : `${err instanceof Error ? err.message : 'The model could not be loaded.'} Check your connection and try again.`,
      });
      return null;
    }
  }, []);

  const addSample = useCallback((classId: string, v: Float32Array, thumb: string) => {
    setDataset((d) => ({
      ...d,
      classes: d.classes.map((c) =>
        c.id === classId && c.samples.length < MAX_SAMPLES
          ? { ...c, samples: [...c.samples, v] }
          : c,
      ),
    }));
    if (thumb) {
      setThumbs((t) => ({
        ...t,
        [classId]: [...(t[classId] ?? []), thumb].slice(-THUMBS_KEPT),
      }));
    }
  }, []);

  // One loop does both jobs: every tick embeds the current frame once, files it as a
  // training example if recording, and classifies it if a head exists.
  const busy = useRef(false);
  useEffect(() => {
    if (camera.status !== 'on' || engine.status !== 'ready') return;
    const timer = setInterval(() => {
      const video = videoRef.current;
      const embedder = embedderRef.current;
      if (busy.current || !video || !embedder || video.readyState < 2) return;
      const { dataset: d, recording: rec } = live.current;
      if (!rec && !d.head) return;
      busy.current = true;
      embedder
        .embed(video)
        .then((v) => {
          const current = live.current.dataset;
          if (live.current.recording) {
            const target = current.classes.find((c) => c.id === current.selectedId);
            if (target && target.samples.length < MAX_SAMPLES) {
              addSample(target.id, v, thumbnail(video));
            } else {
              setRecording(false);
            }
          }
          if (current.head && current.head.dim === v.length) {
            setPredictions(predict(current.head, v));
          }
        })
        .catch(() => setRecording(false))
        .finally(() => {
          busy.current = false;
        });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [camera.status, engine.status, addSample]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera({ status: 'off' });
    setRecording(false);
    setPredictions(null);
  }, []);
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const startCamera = useCallback(async () => {
    setCamera({ status: 'starting' });
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera({ status: 'error', message: cameraMessage(null) });
      return;
    }
    // Load the model and open the camera together; whichever is slower sets the wait.
    const [stream, embedder] = await Promise.all([
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false })
        .catch((e: unknown) => e),
      ensureEmbedder(),
    ]);
    if (stream instanceof MediaStream) {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      if (embedder) {
        setCamera({ status: 'on' });
      } else {
        // No model, so nothing to do with the picture: release the camera, light and all.
        stopCamera();
      }
    } else {
      setCamera({ status: 'error', message: cameraMessage(stream) });
    }
  }, [ensureEmbedder, stopCamera]);

  const toggleRecording = useCallback(() => setRecording((r) => !r), []);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const embedder = await ensureEmbedder();
      if (!embedder) return;
      let skipped = 0;
      for (const file of Array.from(files)) {
        const { dataset: d } = live.current;
        const target = d.classes.find((c) => c.id === d.selectedId);
        if (!target || target.samples.length >= MAX_SAMPLES) {
          skipped++;
          continue;
        }
        try {
          const bitmap = await createImageBitmap(file);
          const v = await embedder.embed(bitmap);
          addSample(target.id, v, thumbnail(bitmap));
          // Let the ref catch up so the next file sees the new count.
          await new Promise((r) => setTimeout(r));
          bitmap.close();
        } catch {
          skipped++;
        }
      }
      if (skipped > 0) {
        setNotice(
          `${skipped} file${skipped === 1 ? ' was' : 's were'} skipped — not an image the browser can read, or the class is full (${MAX_SAMPLES} max).`,
        );
      }
    },
    [ensureEmbedder, addSample],
  );

  /** Classify one picture from disk, for people without a camera (or with a photo to hand). */
  const testFile = useCallback(
    async (file: File) => {
      const head = live.current.dataset.head;
      if (!head) return;
      const embedder = await ensureEmbedder();
      if (!embedder) return;
      try {
        const bitmap = await createImageBitmap(file);
        const v = await embedder.embed(bitmap);
        setTested({ name: file.name, thumb: thumbnail(bitmap) });
        setPredictions(v.length === head.dim ? predict(head, v) : null);
        bitmap.close();
      } catch {
        setNotice(`“${file.name}” is not an image the browser can read.`);
      }
    },
    [ensureEmbedder],
  );

  const train = useCallback(async () => {
    const d = live.current.dataset;
    if (trainBlocker(d) || training) return;
    setRecording(false);
    const usable = d.classes.map((c, k) => ({ c, k })).filter(({ c }) => c.samples.length > 0);
    const x = usable.flatMap(({ c }) => c.samples);
    const y = usable.flatMap(({ c, k }) => c.samples.map(() => k));
    const epochs = 200;
    const classIds = d.classes.map((c) => c.id).join();
    setTraining({ epoch: 0, epochs });
    try {
      const result = await trainHeadAsync(
        { x, y, classes: d.classes.length },
        { epochs, onEpoch: (epoch) => epoch % 5 === 0 && setTraining({ epoch, epochs }) },
      );
      if (live.current.dataset.classes.map((c) => c.id).join() !== classIds) {
        // Classes were added or removed mid-training; the result no longer fits them.
        setNotice(
          'The classes changed while training, so that result was discarded. Train again.',
        );
        return;
      }
      setDataset((cur) => ({
        ...cur,
        head: { ...result.head, labels: cur.classes.map((c) => c.name) },
        trainedOn: cur.classes.reduce((n, c) => n + c.samples.length, 0),
        accuracy: result.accuracy,
      }));
    } finally {
      setTraining(null);
    }
  }, [training]);

  // ---- dataset edits ----

  const selectClass = (id: string) => {
    setRecording(false);
    setDataset((d) => ({ ...d, selectedId: id }));
  };

  const renameClass = (id: string, name: string) =>
    setDataset((d) => ({
      ...d,
      classes: d.classes.map((c) => (c.id === id ? { ...c, name } : c)),
      head: d.head
        ? { ...d.head, labels: d.classes.map((c) => (c.id === id ? name : c.name)) }
        : null,
    }));

  const addClass = () => {
    setRecording(false);
    setDataset((d) => {
      if (d.classes.length >= MAX_CLASSES) return d;
      const id = newId();
      return {
        ...d,
        classes: [
          ...d.classes,
          { id, name: freeClassName(d.classes.map((c) => c.name)), samples: [] },
        ],
        selectedId: id,
        head: null,
        accuracy: null,
        trainedOn: 0,
      };
    });
  };

  const removeClass = (id: string) => {
    setRecording(false);
    setPredictions(null);
    setDataset((d) => {
      if (d.classes.length <= MIN_CLASSES) return d;
      const classes = d.classes.filter((c) => c.id !== id);
      return {
        ...d,
        classes,
        selectedId: d.selectedId === id ? (classes[0]?.id ?? d.selectedId) : d.selectedId,
        head: null,
        accuracy: null,
        trainedOn: 0,
      };
    });
  };

  const clearClass = (id: string) => {
    setThumbs((t) => ({ ...t, [id]: [] }));
    setDataset((d) => ({
      ...d,
      classes: d.classes.map((c) => (c.id === id ? { ...c, samples: [] } : c)),
    }));
  };

  const reset = () => {
    setTested(null);
    setPredictions(null);
    setThumbs({});
    setRecording(false);
    setDataset(emptyDataset());
  };

  // ---- model files ----

  const exportFile = () => {
    const blob = new Blob([exportModel(live.current.dataset)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trainyard-model.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importFile = async (file: File) => {
    const result = importModel(await file.text());
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setPredictions(null);
    setTested(null);
    setThumbs({});
    setDataset(result.dataset);
    setNotice('Model imported.');
  };

  return {
    dataset,
    notice,
    dismissNotice: () => setNotice(null),
    engine,
    camera,
    recording,
    training,
    predictions,
    thumbs,
    videoRef,
    startCamera,
    stopCamera,
    ensureEmbedder,
    toggleRecording,
    addFiles,
    testFile,
    tested,
    train,
    selectClass,
    renameClass,
    addClass,
    removeClass,
    clearClass,
    reset,
    exportFile,
    importFile,
  };
}
