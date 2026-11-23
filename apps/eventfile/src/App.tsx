import { useEffect, useMemo, useRef, useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { Field, inputCls } from './components/Field';
import { Leaf } from './components/Leaf';
import { WEEKDAY_NAMES } from './lib/dates';
import { buildIcs, fileName } from './lib/ics';
import {
  blankForm,
  exampleForm,
  FLOATING,
  isEventForm,
  validate,
  type EventForm,
  type FieldError,
} from './lib/model';
import { describeDate, describeRule, occurrences } from './lib/recur';
import { createStore } from './lib/storage';

const store = createStore<EventForm>({
  key: 'eventfile:state',
  version: 1,
  fallback: exampleForm(),
  validate: isEventForm,
});

function zoneList(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = ['UTC', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'];
  }
  return current !== FLOATING && !zones.includes(current) ? [current, ...zones] : zones;
}

const REMINDERS: [number | null, string][] = [
  [null, 'No reminder'],
  [0, 'At the start'],
  [5, '5 minutes before'],
  [15, '15 minutes before'],
  [30, '30 minutes before'],
  [60, '1 hour before'],
  [1440, '1 day before'],
];

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const btn =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] px-4 font-medium transition-colors duration-[var(--dur-state)]';

export function App() {
  const loaded = useMemo(() => store.load(), []);
  const [form, setForm] = useState<EventForm>(loaded.value);
  const [notice, setNotice] = useState<string | null>(
    loaded.status === 'recovered'
      ? 'Your saved event could not be read, so the example is back. Nothing was lost that could be recovered.'
      : null,
  );
  const [status, setStatus] = useState('');
  const timer = useRef<number | undefined>(undefined);

  const set = <K extends keyof EventForm>(k: K, v: EventForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const errors = validate(form);
  const err = (field: FieldError['field']) => errors.find((e) => e.field === field);

  useEffect(() => {
    store.save(form);
  }, [form]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const zones = useMemo(() => zoneList(form.tz), [form.tz]);
  const dates = errors.length === 0 ? occurrences(form, 6) : [];
  const text = useMemo(() => (errors.length === 0 ? buildIcs(form) : null), [form]);
  const first = dates[0];
  const shifted = errors.length === 0 && form.freq === 'weekly' && first !== form.startDate;

  const say = (m: string) => {
    setStatus(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus(''), 4000);
  };

  const download = () => {
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(form.title);
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(`Downloaded ${a.download}.`);
  };

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      say('Copied the .ics text.');
    } catch {
      say('Copy was blocked by the browser. Select the text below instead.');
    }
  };

  const toggleDay = (d: number) =>
    set(
      'weekdays',
      form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d],
    );

  const repeats = form.freq !== 'none';

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-6">
          <span className="font-mono text-sm tracking-tight text-[var(--text-faint)]">
            eventfile
          </span>
          <ThemeToggle />
        </header>

        <main id="main" className="flex-1 pb-12">
          <h1 className="font-serif text-[length:var(--t-3xl)] leading-tight font-semibold tracking-tight text-balance">
            Write the event once. Get a calendar file that repeats correctly.
          </h1>
          <p className="mt-3 max-w-prose text-[length:var(--t-lg)] text-[var(--text-muted)] text-pretty">
            Fill in the event, pick how it repeats, download a{' '}
            <code className="font-mono">.ics</code> that Google Calendar, Apple Calendar and
            Outlook all accept. No account, no upload.
          </p>

          {notice ? (
            <p
              role="status"
              className="mt-6 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] p-3 text-sm"
            >
              {notice}{' '}
              <button type="button" className="underline" onClick={() => setNotice(null)}>
                Dismiss
              </button>
            </p>
          ) : null}

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <form
              className="flex min-w-0 flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                download();
              }}
              noValidate
              aria-label="Event details"
            >
              <Field id="ev-title" label="Title" error={err('title')}>
                {(p) => (
                  <input
                    {...p}
                    className={inputCls}
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                    autoComplete="off"
                  />
                )}
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="ev-date" label="Starts on" error={err('startDate')}>
                  {(p) => (
                    <input
                      {...p}
                      type="date"
                      className={inputCls}
                      value={form.startDate}
                      onChange={(e) => set('startDate', e.target.value)}
                    />
                  )}
                </Field>
                <label className="flex min-h-11 items-center gap-2 self-end text-sm">
                  <input
                    type="checkbox"
                    className="size-5 accent-[var(--accent)]"
                    checked={form.allDay}
                    onChange={(e) => set('allDay', e.target.checked)}
                  />
                  All-day event
                </label>
              </div>

              {!form.allDay ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field id="ev-start" label="Start time" error={err('startTime')}>
                      {(p) => (
                        <input
                          {...p}
                          type="time"
                          className={inputCls}
                          value={form.startTime}
                          onChange={(e) => set('startTime', e.target.value)}
                        />
                      )}
                    </Field>
                    <Field
                      id="ev-end"
                      label="End time"
                      hint="Earlier than start means the next day."
                      error={err('endTime')}
                    >
                      {(p) => (
                        <input
                          {...p}
                          type="time"
                          className={inputCls}
                          value={form.endTime}
                          onChange={(e) => set('endTime', e.target.value)}
                        />
                      )}
                    </Field>
                  </div>
                  <Field
                    id="ev-tz"
                    label="Time zone"
                    hint="Pick a zone and the event stays at the same clock time through daylight-saving changes."
                    error={err('tz')}
                  >
                    {(p) => (
                      <select
                        {...p}
                        className={inputCls}
                        value={form.tz}
                        onChange={(e) => set('tz', e.target.value)}
                      >
                        <option value={FLOATING}>Floating: each person’s own local time</option>
                        {zones.map((z) => (
                          <option key={z} value={z}>
                            {z.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </>
              ) : null}

              <fieldset className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] p-4">
                <legend className="px-1 text-sm font-medium">Repeat</legend>
                <Field id="ev-freq" label="How often">
                  {(p) => (
                    <select
                      {...p}
                      className={inputCls}
                      value={form.freq}
                      onChange={(e) => set('freq', e.target.value as EventForm['freq'])}
                    >
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  )}
                </Field>

                {repeats ? (
                  <>
                    <Field
                      id="ev-interval"
                      label="Every how many"
                      hint={`1 = every ${form.freq.replace('ly', '').replace('dai', 'day')}, 2 = every other.`}
                      error={err('interval')}
                    >
                      {(p) => (
                        <input
                          {...p}
                          type="number"
                          min={1}
                          max={99}
                          inputMode="numeric"
                          className={inputCls}
                          value={Number.isNaN(form.interval) ? '' : form.interval}
                          onChange={(e) => set('interval', e.target.valueAsNumber)}
                        />
                      )}
                    </Field>

                    {form.freq === 'weekly' ? (
                      <fieldset>
                        <legend className="mb-1.5 text-sm font-medium">On these days</legend>
                        <div className="flex flex-wrap gap-2">
                          {WEEK_ORDER.map((d) => (
                            <label
                              key={d}
                              className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-sm has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent)] has-[:checked]:text-[var(--accent-text)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)]"
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={form.weekdays.includes(d)}
                                onChange={() => toggleDay(d)}
                              />
                              {WEEKDAY_NAMES[d]?.slice(0, 3)}
                              <span className="sr-only">{WEEKDAY_NAMES[d]?.slice(3)}</span>
                            </label>
                          ))}
                        </div>
                        {err('weekdays') ? (
                          <p className="mt-1.5 text-sm font-medium text-[var(--danger)]">
                            {err('weekdays')?.message}
                          </p>
                        ) : null}
                      </fieldset>
                    ) : null}

                    {form.freq === 'monthly' ? (
                      <Field
                        id="ev-mm"
                        label="Which day of the month"
                        hint="Day 29–31 is skipped in months that don’t have it."
                      >
                        {(p) => (
                          <select
                            {...p}
                            className={inputCls}
                            value={form.monthlyMode}
                            onChange={(e) =>
                              set('monthlyMode', e.target.value as EventForm['monthlyMode'])
                            }
                          >
                            <option value="day">Same date each month</option>
                            <option value="nth">Same weekday (e.g. second Tuesday)</option>
                            <option value="last">Last such weekday of the month</option>
                          </select>
                        )}
                      </Field>
                    ) : null}

                    <Field id="ev-endmode" label="Ends">
                      {(p) => (
                        <select
                          {...p}
                          className={inputCls}
                          value={form.endMode}
                          onChange={(e) =>
                            set('endMode', e.target.value as EventForm['endMode'])
                          }
                        >
                          <option value="never">Never</option>
                          <option value="count">After a number of events</option>
                          <option value="until">On a date</option>
                        </select>
                      )}
                    </Field>
                    {form.endMode === 'count' ? (
                      <Field id="ev-count" label="Number of events" error={err('count')}>
                        {(p) => (
                          <input
                            {...p}
                            type="number"
                            min={1}
                            max={999}
                            inputMode="numeric"
                            className={inputCls}
                            value={Number.isNaN(form.count) ? '' : form.count}
                            onChange={(e) => set('count', e.target.valueAsNumber)}
                          />
                        )}
                      </Field>
                    ) : null}
                    {form.endMode === 'until' ? (
                      <Field id="ev-until" label="Last day" error={err('until')}>
                        {(p) => (
                          <input
                            {...p}
                            type="date"
                            className={inputCls}
                            value={form.until}
                            onChange={(e) => set('until', e.target.value)}
                          />
                        )}
                      </Field>
                    ) : null}
                  </>
                ) : null}
              </fieldset>

              <Field id="ev-loc" label="Location (optional)">
                {(p) => (
                  <input
                    {...p}
                    className={inputCls}
                    value={form.location}
                    onChange={(e) => set('location', e.target.value)}
                    autoComplete="off"
                  />
                )}
              </Field>
              <Field id="ev-desc" label="Notes (optional)">
                {(p) => (
                  <textarea
                    {...p}
                    rows={3}
                    className={`${inputCls} py-2`}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                  />
                )}
              </Field>
              <Field id="ev-rem" label="Reminder">
                {(p) => (
                  <select
                    {...p}
                    className={inputCls}
                    value={form.reminder === null ? '' : String(form.reminder)}
                    onChange={(e) =>
                      set('reminder', e.target.value === '' ? null : Number(e.target.value))
                    }
                  >
                    {REMINDERS.map(([v, l]) => (
                      <option key={l} value={v === null ? '' : String(v)}>
                        {l}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <button
                type="button"
                className="self-start text-sm text-[var(--text-muted)] underline underline-offset-2 hover:text-[var(--text)]"
                onClick={() => {
                  setForm(blankForm(form));
                  setNotice(null);
                }}
              >
                Start from blank
              </button>
            </form>

            <section
              aria-labelledby="result-h"
              className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6 lg:self-start"
            >
              <h2 id="result-h" className="sr-only">
                Your calendar file
              </h2>
              <div className="flex items-start gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-sm)]">
                <Leaf iso={first} />
                <div className="min-w-0">
                  <p className="font-serif text-[length:var(--t-xl)] leading-snug font-semibold break-words">
                    {form.title.trim() || 'Untitled event'}
                  </p>
                  <p className="mt-1 text-[var(--text-muted)]">{describeRule(form)}</p>
                  {shifted ? (
                    <p className="mt-1 text-sm text-[var(--text-faint)]">
                      Starts {describeDate(first as string)}, the first chosen weekday on or
                      after your start date.
                    </p>
                  ) : null}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">Next dates</h3>
                {errors.length > 0 ? (
                  <p className="mt-2 text-sm text-[var(--danger)]">
                    Fix the highlighted fields to see dates and download.
                  </p>
                ) : (
                  <ol className="tnum mt-2 grid gap-1 text-[var(--text-muted)]">
                    {dates.map((d) => (
                      <li key={d}>{describeDate(d)}</li>
                    ))}
                    {repeats && form.endMode === 'never' ? (
                      <li className="text-[var(--text-faint)]">…and so on, with no end</li>
                    ) : null}
                  </ol>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={download}
                  disabled={!text}
                  className={`${btn} bg-[var(--accent)] text-[var(--accent-text)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Download .ics
                </button>
                <button
                  type="button"
                  onClick={copy}
                  disabled={!text}
                  className={`${btn} border border-[var(--border-strong)] bg-[var(--surface-raised)] hover:border-[var(--text-faint)] disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Copy text
                </button>
                <p role="status" className="text-sm text-[var(--text-muted)]">
                  {status}
                </p>
              </div>

              <details
                open
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-sunken)]"
              >
                <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">
                  The file itself
                </summary>
                <pre
                  tabIndex={0}
                  aria-label="Calendar file contents"
                  className="max-h-96 overflow-auto px-4 pb-4 font-mono text-xs leading-relaxed whitespace-pre text-[var(--text-muted)]"
                >
                  {text ? text.replace(/\r\n/g, '\n') : 'Nothing to show yet.'}
                </pre>
              </details>
            </section>
          </div>

          <section aria-labelledby="how-h" className="mt-16 max-w-prose">
            <h2 id="how-h" className="font-serif text-[length:var(--t-xl)] font-semibold">
              Why the time zone matters
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">
              A weekly 19:00 meeting should stay at 19:00 when the clocks change. Eventfile
              writes the zone’s daylight-saving rules into the file, so calendars keep the event
              at the same clock time all year. Choose “Floating” if the event should happen at
              each person’s own local time instead.
            </p>
          </section>
        </main>

        <footer className="border-t border-[var(--border)] py-6 text-sm text-[var(--text-faint)]">
          <p>
            Runs entirely in your browser and works offline. Your event never leaves this
            device.{' '}
            <a
              className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
              href="https://github.com/oliverinhalo/eventfile"
            >
              Source
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
