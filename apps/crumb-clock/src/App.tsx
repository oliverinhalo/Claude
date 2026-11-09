import { useEffect, useMemo, useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { buildIcs } from './lib/ics';
import { decodePlan, encodePlan, savedStore } from './lib/plan-store';
import {
  TEMP_MAX,
  TEMP_MIN,
  buildSchedule,
  defaultReadyAt,
  earliestReady,
  formatDuration,
  fromLocalInput,
  isFeasible,
  toLocalInput,
  totalMinutes,
  type Method,
  type Plan,
  type Step,
} from './lib/schedule';

const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const day = (ms: number) => dayFmt.format(ms);
const time = (ms: number) => timeFmt.format(ms);

function initialPlan(now: number): { plan: Plan; recovered: string | null; shared: boolean } {
  const fromUrl = decodePlan(window.location.hash);
  if (fromUrl) return { plan: fromUrl, recovered: null, shared: true };
  const saved = savedStore.load();
  const { method, roomTemp } = saved.value;
  return {
    plan: { readyAt: defaultReadyAt(now, method, roomTemp), method, roomTemp },
    recovered: saved.status === 'recovered' ? saved.reason : null,
    shared: false,
  };
}

function download(filename: string, body: string): void {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [now] = useState(() => Date.now());
  const [init] = useState(() => initialPlan(now));
  const [plan, setPlan] = useState<Plan>(init.plan);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    savedStore.save({ method: plan.method, roomTemp: plan.roomTemp });
  }, [plan.method, plan.roomTemp]);

  const steps = useMemo(() => buildSchedule(plan), [plan]);
  const feasible = isFeasible(plan, now);
  const earliest = earliestReady(now, plan.method, plan.roomTemp);
  const first = steps[0] ?? { at: plan.readyAt };
  const nightSteps = steps.filter((s) => s.antisocial);

  const setMethod = (method: Method) => setPlan((p) => ({ ...p, method }));
  const setTemp = (roomTemp: number) => setPlan((p) => ({ ...p, roomTemp }));
  const setReady = (value: string) => {
    const t = fromLocalInput(value);
    if (t !== null) setPlan((p) => ({ ...p, readyAt: t }));
  };

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#${encodePlan(plan)}`;
    window.history.replaceState(null, '', `#${encodePlan(plan)}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const control =
    'min-h-11 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[var(--text)]';

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-6">
          <span className="font-[family-name:var(--font-display)] text-lg tracking-tight">
            <span aria-hidden="true">◔ </span>crumb clock
          </span>
          <ThemeToggle />
        </header>

        <main id="main" className="flex-1 py-4">
          <h1 className="font-[family-name:var(--font-display)] text-[length:var(--t-3xl)] leading-tight font-semibold tracking-tight text-balance">
            Bread on the table at {time(plan.readyAt)}
          </h1>
          <p className="mt-3 max-w-prose text-[length:var(--t-lg)] text-[var(--text-muted)] text-pretty">
            Pick when the loaf should be ready. Crumb Clock works backwards to when you feed the
            starter, mix, shape and bake.
          </p>

          {init.recovered && (
            <p
              role="status"
              className="mt-4 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] p-3 text-sm"
            >
              Your saved settings could not be read ({init.recovered}), so we started fresh.
            </p>
          )}

          <form
            aria-label="Your bake"
            onSubmit={(e) => e.preventDefault()}
            className="mt-8 grid gap-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-5 shadow-[var(--shadow-sm)] sm:grid-cols-2"
          >
            <label className="block text-sm font-medium sm:col-span-2">
              Ready to slice
              <input
                type="datetime-local"
                className={`${control} mt-1`}
                value={toLocalInput(plan.readyAt)}
                onChange={(e) => {
                  setReady(e.target.value);
                }}
              />
            </label>

            <fieldset className="text-sm font-medium">
              <legend>Method</legend>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(
                  [
                    ['same-day', 'Same day'],
                    ['overnight', 'Overnight in the fridge'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 font-normal has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--surface-sunken)] has-[:checked]:font-medium"
                  >
                    <input
                      type="radio"
                      name="method"
                      value={value}
                      checked={plan.method === value}
                      onChange={() => setMethod(value)}
                      className="accent-[var(--accent)]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm font-medium">
              Kitchen temperature: <span className="tnum">{plan.roomTemp} °C</span>
              <input
                type="range"
                min={TEMP_MIN}
                max={TEMP_MAX}
                step={1}
                value={plan.roomTemp}
                onChange={(e) => setTemp(Number(e.target.value))}
                className="mt-3 block min-h-11 w-full accent-[var(--accent)]"
              />
              <span className="block text-xs font-normal text-[var(--text-faint)]">
                Warmer kitchens ferment faster. Dough, not the clock, has the last word.
              </span>
            </label>
          </form>

          <section aria-labelledby="plan-h" className="mt-10">
            <h2
              id="plan-h"
              className="font-[family-name:var(--font-display)] text-[length:var(--t-2xl)] font-semibold"
            >
              {feasible ? (
                <>
                  Start feeding your starter {day(first.at)} at {time(first.at)}
                </>
              ) : (
                <>Not enough time for that</>
              )}
            </h2>
            <p className="mt-1 text-[var(--text-muted)]">
              {formatDuration(totalMinutes(steps))} from first feed to first slice.
            </p>

            {!feasible && (
              <div
                role="alert"
                className="mt-4 rounded-[var(--radius)] border border-[var(--danger)] p-4"
              >
                <p>
                  That plan needs you to begin {day(first.at)} at {time(first.at)}, which has
                  already passed. The earliest you can eat is {day(earliest)} at{' '}
                  {time(earliest)}.
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-4 font-medium text-[var(--accent-text)]"
                  onClick={() => {
                    setPlan((p) => ({
                      ...p,
                      readyAt: defaultReadyAt(now, p.method, p.roomTemp),
                    }));
                  }}
                >
                  Use the next sensible evening
                </button>
              </div>
            )}

            {feasible && nightSteps.length > 0 && (
              <p className="mt-4 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] p-3 text-sm">
                {nightSteps.length === 1 ? 'One step falls' : `${nightSteps.length} steps fall`}{' '}
                in the small hours.{' '}
                {plan.method === 'same-day'
                  ? 'Try the overnight method: the fridge does the waiting for you.'
                  : 'Move the ready time later to keep your sleep.'}
              </p>
            )}

            <ol className="mt-6 border-l-2 border-[var(--border-strong)] pl-6">
              {steps.map((s) => (
                <StepRow key={s.id} step={s} />
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!feasible}
                onClick={() => download('sourdough-schedule.ics', buildIcs(steps, Date.now()))}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-4 font-medium text-[var(--accent-text)] disabled:opacity-50"
              >
                Add to my calendar (.ics)
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="min-h-11 rounded-[var(--radius)] border border-[var(--border-strong)] px-4 font-medium"
              >
                {copied ? 'Link copied' : 'Copy a link to this plan'}
              </button>
            </div>
            <p role="status" className="sr-only">
              {copied ? 'Link copied to clipboard' : ''}
            </p>
          </section>

          <section aria-labelledby="how" className="mt-12 text-[var(--text-muted)]">
            <h2
              id="how"
              className="font-[family-name:var(--font-display)] text-[length:var(--t-xl)] font-semibold text-[var(--text)]"
            >
              How the times are worked out
            </h2>
            <p className="mt-2 max-w-prose">
              The baseline is a 24 °C kitchen with a lively starter. Every 8 °C cooler roughly
              doubles fermentation, every 8 °C warmer halves it. Treat the clock as a plan and
              the dough as the judge: if it has not risen by the time the schedule says, give it
              longer.
            </p>
          </section>
        </main>

        <footer className="border-t border-[var(--border)] py-6 text-sm text-[var(--text-faint)]">
          <p>
            Runs entirely in your browser. Nothing you enter leaves this device.{' '}
            <a
              className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
              href="https://github.com/oliverinhalo/crumb-clock"
            >
              Source
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}

function StepRow({ step }: { step: Step }) {
  return (
    <li className="relative pb-6 last:pb-0">
      <span
        aria-hidden="true"
        className={`absolute top-1.5 -left-[1.9rem] h-3 w-3 rounded-full border-2 ${step.antisocial ? 'border-[var(--danger)] bg-[var(--surface)]' : 'border-[var(--accent)] bg-[var(--accent)]'}`}
      />
      <p className="tnum text-sm text-[var(--text-muted)]">
        {day(step.at)} · {time(step.at)} · {formatDuration(step.minutes)}
        {step.antisocial && <strong className="text-[var(--danger)]"> · night-time</strong>}
      </p>
      <h3 className="font-[family-name:var(--font-display)] text-[length:var(--t-lg)] font-semibold">
        {step.title}
      </h3>
      <p className="max-w-prose text-[var(--text-muted)]">{step.detail}</p>
    </li>
  );
}
