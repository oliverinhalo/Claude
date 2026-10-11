import type { Dataset } from '../lib/dataset';
import type { Prediction } from '../lib/head';

export function Predictions({
  dataset,
  predictions,
  cameraOn,
}: {
  dataset: Dataset;
  predictions: Prediction[] | null;
  cameraOn: boolean;
}) {
  const head = dataset.head;
  if (!head) {
    return (
      <p className="text-[var(--text-muted)]">
        Nothing is trained yet. Once two classes have examples, press <strong>Train</strong> and
        the live prediction appears here.
      </p>
    );
  }
  const total = dataset.classes.reduce((n, c) => n + c.samples.length, 0);
  const stale = total !== dataset.trainedOn;
  return (
    <div>
      {dataset.accuracy !== null && (
        <p className="text-sm text-[var(--text-muted)]">
          Trained on {dataset.trainedOn} examples · {Math.round(dataset.accuracy * 100)}% right
          on its own training set.
          {stale && ' You have changed the examples since — train again to include them.'}
        </p>
      )}
      {!cameraOn && (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Start the camera to see live predictions.
        </p>
      )}
      <ol className="mt-3 grid gap-3" aria-label="Predicted classes" aria-live="off">
        {(predictions ?? head.labels.map((_, index) => ({ index, probability: 0 }))).map(
          (p, rank) => (
            <li key={p.index} style={{ ['--lamp' as string]: `var(--k-${p.index})` }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="lamp" aria-hidden="true" />
                  <span
                    className={`truncate ${rank === 0 && predictions ? 'font-semibold' : ''}`}
                  >
                    {head.labels[p.index]}
                  </span>
                </span>
                <span className="tnum text-sm text-[var(--text-muted)]">
                  {Math.round(p.probability * 100)}%
                </span>
              </div>
              <div
                className="bar mt-1"
                role="progressbar"
                aria-label={head.labels[p.index]}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(p.probability * 100)}
              >
                <span style={{ width: `${p.probability * 100}%` }} />
              </div>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}
