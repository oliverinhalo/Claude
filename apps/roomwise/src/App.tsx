import { useEffect, useMemo, useRef, useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import {
  areaMax,
  compute,
  EXAMPLE,
  explain,
  FT2_PER_M2 as FT2,
  formatAmount,
  LIMITS,
  summary,
  type AreaUnit,
  type State,
} from './lib/split';
import {
  decodeHash,
  encodeState,
  loadInitial,
  newRoom,
  serializable,
  store,
} from './lib/state';

const SWATCH = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'] as const;
const swatch = (i: number) => `var(${SWATCH[i % SWATCH.length]})`;

const field =
  'min-h-11 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[var(--text)]';
const btn =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-4 text-sm text-[var(--text)] transition-colors duration-[var(--dur-state)] hover:bg-[var(--surface-sunken)]';
const btnPrimary =
  'inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] hover:opacity-90';

/** Parse a number field. Empty string stays NaN so the UI can say what is missing. */
const toNum = (v: string): number => (v.trim() === '' ? NaN : Number(v));
const show = (n: number) => (Number.isFinite(n) ? String(n) : '');

export function App() {
  const initial = useMemo(() => loadInitial(window.location.hash), []);
  const [state, setState] = useState<State>(initial.state);
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [status, setStatus] = useState('');
  const [showPerks, setShowPerks] = useState(false);
  const lastNameRef = useRef<HTMLInputElement | null>(null);
  const addedRef = useRef(false);

  const result = useMemo(() => compute(state), [state]);

  useEffect(() => {
    store.save(serializable(state));
    const next = `#${encodeState(state)}`;
    if (window.location.hash !== next) history.replaceState(null, '', next);
  }, [state]);

  useEffect(() => {
    const onHash = () => {
      const h = decodeHash(window.location.hash);
      if (h.status === 'ok') setState(h.state);
      else if (h.status === 'bad')
        setNotice('That share link could not be read, so the previous split is kept.');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (addedRef.current) {
      addedRef.current = false;
      lastNameRef.current?.focus();
      lastNameRef.current?.select();
    }
  }, [state.rooms.length]);

  const patch = (p: Partial<State>) => setState((s) => ({ ...s, ...p }));
  const patchRoom = (id: string, p: Partial<State['rooms'][number]>) =>
    setState((s) => ({ ...s, rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...p } : r)) }));

  const setUnit = (unit: AreaUnit) => {
    if (unit === state.unit) return;
    const k = unit === 'ft2' ? FT2 : 1 / FT2;
    const max = areaMax(unit);
    const conv = (n: number) =>
      Number.isFinite(n) ? Math.min(max, Math.round(n * k * 10) / 10) : n;
    setState((s) => ({
      ...s,
      unit,
      shared: conv(s.shared),
      rooms: s.rooms.map((r) => ({ ...r, area: conv(r.area) })),
    }));
  };

  const flash = (msg: string) => {
    setStatus('');
    window.setTimeout(() => setStatus(msg), 30);
  };
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      flash('Copying was blocked by the browser. Select the text and copy it by hand.');
    }
  };

  const unitLabel = state.unit === 'm2' ? 'm²' : 'ft²';
  const rentBad = !Number.isFinite(state.rent) || state.rent <= 0;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-6">
          <span className="display text-[length:var(--t-lg)] font-semibold">roomwise</span>
          <ThemeToggle />
        </header>

        <main id="main" className="flex-1 pb-8">
          <h1 className="display text-[length:var(--t-3xl)] leading-[1.1] font-semibold text-balance">
            Split the rent by the room, not by the head.
          </h1>
          <p className="mt-4 max-w-prose text-[length:var(--t-lg)] text-[var(--text-muted)] text-pretty">
            Bigger rooms and better perks pay more. Change anything below and the split updates,
            adding up to the rent exactly.
          </p>

          {notice && (
            <p
              role="status"
              className="mt-6 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-sunken)] p-3 text-sm"
            >
              {notice}{' '}
              <button type="button" className="underline" onClick={() => setNotice(null)}>
                Dismiss
              </button>
            </p>
          )}

          <section aria-labelledby="house" className="mt-8">
            <h2 id="house" className="sr-only">
              The house
            </h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label htmlFor="rent" className="mb-1 block text-sm text-[var(--text-muted)]">
                  Total rent per month
                </label>
                <div className="flex gap-2">
                  <input
                    aria-label="Currency symbol"
                    className={`${field} w-16 text-center`}
                    maxLength={3}
                    value={state.currency}
                    onChange={(e) => patch({ currency: e.target.value })}
                  />
                  <input
                    id="rent"
                    className={`${field} tnum`}
                    inputMode="decimal"
                    type="number"
                    min={0}
                    max={LIMITS.rent}
                    step="any"
                    value={show(state.rent)}
                    aria-invalid={rentBad}
                    aria-describedby={rentBad ? 'rent-err' : undefined}
                    onChange={(e) =>
                      patch({ rent: Math.min(toNum(e.target.value), LIMITS.rent) })
                    }
                  />
                </div>
                {rentBad && (
                  <p id="rent-err" className="mt-1 text-sm text-[var(--danger)]">
                    Enter the total monthly rent, above zero.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="shared" className="mb-1 block text-sm text-[var(--text-muted)]">
                  Shared space ({unitLabel})
                </label>
                <input
                  id="shared"
                  className={`${field} tnum`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={areaMax(state.unit)}
                  step="any"
                  value={show(state.shared)}
                  onChange={(e) =>
                    patch({ shared: Math.min(toNum(e.target.value) || 0, areaMax(state.unit)) })
                  }
                />
              </div>
              <div>
                <label htmlFor="unit" className="mb-1 block text-sm text-[var(--text-muted)]">
                  Sizes in
                </label>
                <select
                  id="unit"
                  className={field}
                  value={state.unit}
                  onChange={(e) => setUnit(e.target.value as AreaUnit)}
                >
                  <option value="m2">square metres</option>
                  <option value="ft2">square feet</option>
                </select>
              </div>
            </div>
          </section>

          <section aria-labelledby="split" className="mt-10">
            <h2 id="split" className="display text-[length:var(--t-xl)] font-semibold">
              The split
            </h2>

            {result.shares.length > 0 && (
              <div
                className="plan mt-4"
                role="img"
                aria-label="Each room's share of the rent, drawn to scale"
              >
                {result.shares.map((s, i) => (
                  <span
                    key={s.id}
                    style={{ flexGrow: s.fraction * 1000, background: swatch(i) }}
                  />
                ))}
              </div>
            )}

            {!result.ok && (
              <p role="status" className="mt-4 text-[var(--danger)]">
                {result.reason}
              </p>
            )}

            {state.rooms.length === 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={() => {
                    addedRef.current = true;
                    patch({ rooms: [newRoom(1)] });
                  }}
                >
                  Add the first room
                </button>
                <button type="button" className={btn} onClick={() => setState(EXAMPLE)}>
                  Restore the example
                </button>
              </div>
            )}

            <ul className="mt-4 grid gap-4">
              {state.rooms.map((room, i) => {
                const share = result.shares[i];
                const last = i === state.rooms.length - 1;
                return (
                  <li
                    key={room.id}
                    className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] p-4"
                    style={{ borderLeft: `6px solid ${swatch(i)}` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`name-${room.id}`} className="sr-only">
                          Name of room {i + 1}
                        </label>
                        <input
                          id={`name-${room.id}`}
                          ref={last ? lastNameRef : undefined}
                          className={`${field} display font-semibold`}
                          maxLength={60}
                          value={room.name}
                          onChange={(e) => patchRoom(room.id, { name: e.target.value })}
                        />
                      </div>
                      <p
                        className="display tnum pt-1 text-[length:var(--t-xl)] font-semibold"
                        aria-label={`Share for ${room.name || `room ${i + 1}`}`}
                      >
                        {share && share.valid && result.ok
                          ? formatAmount(share.amount, state)
                          : '—'}
                      </p>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
                      <div>
                        <label
                          htmlFor={`area-${room.id}`}
                          className="mb-1 block text-sm text-[var(--text-muted)]"
                        >
                          Size ({unitLabel})
                        </label>
                        <input
                          id={`area-${room.id}`}
                          className={`${field} tnum`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={areaMax(state.unit)}
                          step="any"
                          value={show(room.area)}
                          aria-invalid={!share?.valid}
                          onChange={(e) =>
                            patchRoom(room.id, {
                              area: Math.min(toNum(e.target.value), areaMax(state.unit)),
                            })
                          }
                        />
                        {!share?.valid && (
                          <p className="mt-1 text-sm text-[var(--danger)]">
                            Needs a size above zero.
                          </p>
                        )}
                      </div>
                      <fieldset>
                        <legend className="mb-1 text-sm text-[var(--text-muted)]">
                          Perks and drawbacks
                        </legend>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {state.perks.map((p) => (
                            <label
                              key={p.id}
                              className="flex min-h-8 items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                className="size-4 accent-[var(--accent)]"
                                checked={room.perks.includes(p.id)}
                                onChange={(e) =>
                                  patchRoom(room.id, {
                                    perks: e.target.checked
                                      ? [...room.perks, p.id]
                                      : room.perks.filter((x) => x !== p.id),
                                  })
                                }
                              />
                              {p.label}{' '}
                              <span className="tnum text-[var(--text-faint)]">
                                ({p.pct > 0 ? '+' : '−'}
                                {Math.abs(p.pct)}%)
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-4">
                      <p className="text-sm text-[var(--text-muted)]">
                        {share && share.valid
                          ? explain(share, state.unit)
                          : 'Waiting for a size.'}
                      </p>
                      <button
                        type="button"
                        className="min-h-11 shrink-0 rounded-[var(--radius)] px-3 text-sm text-[var(--text-muted)] underline hover:text-[var(--danger)]"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            rooms: s.rooms.filter((r) => r.id !== room.id),
                          }))
                        }
                      >
                        Remove<span className="sr-only"> {room.name || `room ${i + 1}`}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={btn}
                disabled={state.rooms.length >= LIMITS.rooms}
                onClick={() => {
                  addedRef.current = true;
                  setState((s) => ({ ...s, rooms: [...s.rooms, newRoom(s.rooms.length + 1)] }));
                }}
              >
                Add a room
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={!result.ok}
                onClick={() =>
                  copy(window.location.href, 'Link copied. Anyone with it sees this split.')
                }
              >
                Copy share link
              </button>
              <button
                type="button"
                className={btn}
                disabled={!result.ok}
                onClick={() =>
                  copy(
                    summary(state, result),
                    'Summary copied, ready to paste into the house chat.',
                  )
                }
              >
                Copy as text
              </button>
            </div>
            <p
              role="status"
              aria-live="polite"
              className="mt-2 min-h-6 text-sm text-[var(--success)]"
            >
              {status}
            </p>
          </section>

          <section aria-labelledby="settings" className="mt-6">
            <h2 id="settings" className="display text-[length:var(--t-lg)] font-semibold">
              Make it fit your house
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
                  checked={state.cents}
                  onChange={(e) => patch({ cents: e.target.checked })}
                />
                Show pence and cents
              </label>
              <button
                type="button"
                className={btn}
                aria-expanded={showPerks}
                aria-controls="perk-weights"
                onClick={() => setShowPerks((v) => !v)}
              >
                {showPerks ? 'Hide' : 'Adjust'} perk weights
              </button>
              <button type="button" className={btn} onClick={() => setState(EXAMPLE)}>
                Reset to the example
              </button>
            </div>
            {showPerks && (
              <ul id="perk-weights" className="mt-3 grid gap-2">
                {state.perks.map((p) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <label htmlFor={`pct-${p.id}`} className="flex-1 text-sm">
                      {p.label} (% of a room’s weight)
                    </label>
                    <input
                      id={`pct-${p.id}`}
                      className={`${field} tnum w-24`}
                      type="number"
                      min={-LIMITS.perk}
                      max={LIMITS.perk}
                      step={1}
                      value={p.pct}
                      onChange={(e) => {
                        const v = Math.max(
                          -LIMITS.perk,
                          Math.min(LIMITS.perk, toNum(e.target.value) || 0),
                        );
                        setState((s) => ({
                          ...s,
                          perks: s.perks.map((x) => (x.id === p.id ? { ...x, pct: v } : x)),
                        }));
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="how" className="mt-10">
            <h2 id="how" className="display text-[length:var(--t-lg)] font-semibold">
              How the split is worked out
            </h2>
            <p className="mt-2 max-w-prose text-[var(--text-muted)]">
              Each room’s weight is its size plus an equal slice of the shared space, nudged up
              or down by its perks. Your share of the rent is your weight divided by everyone’s.
              Amounts are rounded so they add up to the rent to the last penny, and the
              arithmetic is shown under every room so nobody has to take your word for it.
            </p>
          </section>
        </main>

        <footer className="border-t border-[var(--border)] py-6 text-sm text-[var(--text-faint)]">
          <p>
            Runs entirely in your browser. Your data never leaves this device.{' '}
            <a
              className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
              href="https://github.com/oliverinhalo/roomwise"
            >
              Source
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
