import { useRef } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { ClassCard } from './components/ClassCard';
import { Predictions } from './components/Predictions';
import { MAX_CLASSES, totalSamples, trainBlocker } from './lib/dataset';
import { useTrainyard } from './lib/useTrainyard';

export function App() {
  const t = useTrainyard();
  const { dataset, camera, engine, recording, training } = t;
  const fileInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const testInput = useRef<HTMLInputElement>(null);

  const selectedIndex = Math.max(
    0,
    dataset.classes.findIndex((c) => c.id === dataset.selectedId),
  );
  const selected = dataset.classes[selectedIndex] ?? dataset.classes[0];
  if (!selected) return null;
  const blocker = trainBlocker(dataset);
  const cameraOn = camera.status === 'on';
  const loading = engine.status === 'loading' || camera.status === 'starting';

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="track" aria-hidden="true" />
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-4">
          <span className="font-mono text-sm font-semibold tracking-tight">trainyard</span>
          <ThemeToggle />
        </header>

        <main id="main" className="flex-1 pb-12">
          <h1 className="max-w-[18ch] text-[length:var(--t-3xl)] leading-[1.05] font-semibold tracking-tight text-balance">
            Teach your webcam what things are.
          </h1>
          <p className="mt-3 max-w-prose text-[length:var(--t-lg)] text-[var(--text-muted)] text-pretty">
            Show it a few examples, name them, and it learns to tell them apart. Everything
            happens in this tab — your pictures never leave your device.
          </p>

          <ol className="mt-5 grid gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-3">
            {[
              ['1', 'Record', 'Pick a class and record examples of it.'],
              ['2', 'Train', 'Takes a second or two, on your device.'],
              ['3', 'Test', 'Hold something up and watch it guess.'],
            ].map(([n, title, body]) => (
              <li key={n} className="flex gap-3">
                <span className="font-mono text-[var(--accent)]" aria-hidden="true">
                  {n}
                </span>
                <span>
                  <strong className="text-[var(--text)]">{title}.</strong> {body}
                </span>
              </li>
            ))}
          </ol>

          {t.notice && (
            <div
              role="status"
              className="panel mt-6 flex items-start justify-between gap-4 p-3 text-sm"
            >
              <p>{t.notice}</p>
              <button type="button" className="btn btn-quiet btn-sm" onClick={t.dismissNotice}>
                Dismiss
              </button>
            </div>
          )}

          <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* ---- camera + examples ---- */}
            <section aria-labelledby="camera-h" className="grid min-w-0 content-start gap-4">
              <h2 id="camera-h" className="eyebrow">
                Camera
              </h2>
              <div
                className="video-frame"
                style={{ ['--lamp' as string]: `var(--k-${selectedIndex})` }}
              >
                <video ref={t.videoRef} muted playsInline aria-label="Live camera preview" />
                {!cameraOn && (
                  <div className="absolute inset-0 grid place-items-center p-6 text-center">
                    <p className="max-w-[28ch] text-[var(--text-muted)]">
                      {loading
                        ? engine.status === 'loading' && engine.stage === 'weights'
                          ? 'Downloading the vision model (about 5 MB, once)…'
                          : 'Getting ready…'
                        : 'The camera is off. Nothing is being recorded.'}
                    </p>
                  </div>
                )}
                {recording && <div className="rec-ring" aria-hidden="true" />}
              </div>

              {camera.status === 'error' && (
                <p role="alert" className="text-sm text-[var(--danger)]">
                  {camera.message}
                </p>
              )}
              {engine.status === 'error' && (
                <div role="alert" className="text-sm text-[var(--danger)]">
                  <p>{engine.message}</p>
                  <button type="button" className="btn btn-sm mt-2" onClick={t.startCamera}>
                    Try again
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {cameraOn ? (
                  <button type="button" className="btn" onClick={t.stopCamera}>
                    Stop camera
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={t.startCamera}
                    disabled={loading}
                  >
                    {loading ? 'Loading…' : 'Start camera'}
                  </button>
                )}
                <button
                  type="button"
                  className={`btn ${recording ? 'btn-primary' : ''}`}
                  disabled={!cameraOn}
                  aria-pressed={recording}
                  onClick={t.toggleRecording}
                >
                  {recording ? 'Stop recording' : `Record “${selected.name}”`}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={engine.status === 'loading'}
                  onClick={() => fileInput.current?.click()}
                >
                  Add images…
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  aria-label="Choose images to add to the selected class"
                  data-testid="image-input"
                  onChange={(e) => {
                    if (e.target.files) void t.addFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                />
              </div>
              <p className="text-sm text-[var(--text-faint)]">
                Examples go into the selected class: <strong>{selected.name}</strong>. Vary the
                angle, distance and light while you record.
              </p>
            </section>

            {/* ---- classes ---- */}
            <section aria-labelledby="classes-h" className="grid min-w-0 content-start gap-4">
              <div className="flex items-center justify-between">
                <h2 id="classes-h" className="eyebrow">
                  Classes
                </h2>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={dataset.classes.length >= MAX_CLASSES}
                  onClick={t.addClass}
                >
                  Add class
                </button>
              </div>
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
                {dataset.classes.map((c, i) => (
                  <ClassCard
                    key={c.id}
                    data={c}
                    index={i}
                    selected={c.id === dataset.selectedId}
                    recording={recording}
                    classCount={dataset.classes.length}
                    thumbs={t.thumbs[c.id] ?? []}
                    onSelect={() => t.selectClass(c.id)}
                    onRename={(name) => t.renameClass(c.id, name)}
                    onRemove={() => t.removeClass(c.id)}
                    onClear={() => t.clearClass(c.id)}
                  />
                ))}
              </ul>
            </section>
          </div>

          {/* ---- train + predict ---- */}
          <section aria-labelledby="model-h" className="panel mt-8 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="model-h" className="eyebrow">
                Model
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={blocker !== null || training !== null}
                  onClick={() => void t.train()}
                >
                  {training
                    ? `Training… ${Math.round((training.epoch / training.epochs) * 100)}%`
                    : 'Train'}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!dataset.head}
                  onClick={t.exportFile}
                >
                  Export
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => importInput.current?.click()}
                >
                  Import
                </button>
                <input
                  ref={importInput}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  aria-label="Choose a Trainyard model file to import"
                  data-testid="import-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void t.importFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
            {dataset.head && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={engine.status === 'loading'}
                  onClick={() => testInput.current?.click()}
                >
                  Test with an image…
                </button>
                {t.tested && (
                  <span className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                    <img src={t.tested.thumb} alt="" className="h-8 w-8 rounded" />
                    Showing the result for {t.tested.name}
                  </span>
                )}
                <input
                  ref={testInput}
                  type="file"
                  accept="image/*"
                  hidden
                  aria-label="Choose an image to classify"
                  data-testid="test-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void t.testFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
            )}
            {blocker && <p className="mt-3 text-sm text-[var(--text-muted)]">{blocker}</p>}
            <div className="mt-4" aria-live="polite">
              <Predictions dataset={dataset} predictions={t.predictions} cameraOn={cameraOn} />
            </div>
          </section>

          {totalSamples(dataset) > 0 && (
            <p className="mt-6 text-sm">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => {
                  if (window.confirm('Delete every class, example and the trained model?'))
                    t.reset();
                }}
              >
                Start over
              </button>
            </p>
          )}
        </main>

        <footer className="border-t border-[var(--border)] py-6 text-sm text-[var(--text-faint)]">
          <p>
            Runs entirely in your browser: the vision model (MobileNet, via TensorFlow.js) is
            downloaded once, and your examples are saved only on this device.{' '}
            <a
              className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
              href="https://github.com/oliverinhalo/trainyard"
            >
              Source
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
