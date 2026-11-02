import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { ColourField } from './components/ColourField';
import { FixCard } from './components/FixCard';
import { contrast, parseColor, type RGB } from './lib/color';
import { TARGETS, solve, type Fix, type Target } from './lib/fix';
import { SEED, fromHash, store, toHash, type HuekeepState } from './lib/state';

/** A shared link is read once, then removed from the address bar so reloads keep later edits. */
function takeSharedLink(): HuekeepState | null {
  if (typeof location === 'undefined' || !location.hash) return null;
  const shared = fromHash(location.hash);
  if (shared) history.replaceState(null, '', location.pathname + location.search);
  return shared;
}

function initial(): HuekeepState {
  return takeSharedLink() ?? store.load().value;
}

/** WCAG does not round up: 4.4954 is not 4.50. Floor to two decimals. */
const show = (ratio: number) => (Math.floor(ratio * 100 + 1e-9) / 100).toFixed(2);

export function App() {
  const [state, setState] = useState<HuekeepState>(initial);
  const [status, setStatus] = useState('');
  const last = useRef<{ fg: RGB; bg: RGB }>({ fg: [232, 89, 12], bg: [255, 255, 255] });

  // A share link pasted into an already-open tab only changes the hash.
  useEffect(() => {
    const onHash = () => {
      const shared = takeSharedLink();
      if (shared) setState(shared);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    store.save(state);
  }, [state]);

  const fgP = parseColor(state.fg);
  const bgP = parseColor(state.bg);
  if (fgP.ok && bgP.ok) last.current = { fg: fgP.rgb, bg: bgP.rgb };
  const stale = !(fgP.ok && bgP.ok);
  const { fg, bg } = last.current;

  const outcome = useMemo(() => solve(fg, bg, state.target), [fg, bg, state.target]);
  const ratio = contrast(fg, bg);

  const set = useCallback(
    (patch: Partial<HuekeepState>) => setState((s) => ({ ...s, ...patch })),
    [],
  );

  const copy = useCallback(async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${what}.`);
    } catch {
      setStatus(`Your browser blocked copying. Select ${what} and copy it by hand.`);
    }
  }, []);

  const use = (fix: Fix) => {
    set(fix.role === 'text' ? { fg: fix.hex } : { bg: fix.hex });
    setStatus(`Now using ${fix.hex}.`);
  };

  const swap = () => set({ fg: state.bg, bg: state.fg });
  const reset = () => {
    setState({ ...SEED, target: state.target });
    setStatus('Back to the example.');
  };
  const share = () =>
    !fgP.ok || !bgP.ok
      ? setStatus('Fix the highlighted colour first, then copy the link.')
      : copy(location.origin + location.pathname + toHash(state), 'the share link');

  const onTargetKey = (e: React.KeyboardEvent) => {
    const i = TARGETS.findIndex((t) => t.value === state.target);
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = TARGETS[(i + step + TARGETS.length) % TARGETS.length];
    if (next) {
      set({ target: next.value });
      requestAnimationFrame(() => document.getElementById(`target-${next.value}`)?.focus());
    }
  };

  const passes = ratio >= state.target;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-6">
          <span className="font-mono text-sm tracking-tight text-[var(--text-faint)]">
            huekeep
          </span>
          <ThemeToggle />
        </header>

        <main id="main" className="flex-1 pb-12">
          <h1 className="text-[length:var(--t-3xl)] leading-[1.1] font-semibold tracking-tight text-balance">
            Fix a failing colour pair without changing its hue
          </h1>
          <p className="mt-4 max-w-prose text-[length:var(--t-lg)] text-[var(--text-muted)] text-pretty">
            Huekeep finds the nearest colour that passes WCAG contrast, so your brand orange
            stays orange.
          </p>

          <section aria-labelledby="pair" className="mt-10">
            <h2 id="pair" className="sr-only">
              Your colours
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <ColourField
                label="Text colour"
                value={state.fg}
                onChange={(fg) => set({ fg })}
                error={fgP.ok ? null : fgP.reason}
              />
              <ColourField
                label="Background"
                value={state.bg}
                onChange={(bg) => set({ bg })}
                error={bgP.ok ? null : bgP.reason}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <fieldset className="contents">
                <legend className="sr-only">Contrast target</legend>
                <div
                  role="radiogroup"
                  aria-label="Contrast target"
                  onKeyDown={onTargetKey}
                  className="flex flex-wrap gap-2"
                >
                  {TARGETS.map((t) => (
                    <button
                      key={t.value}
                      id={`target-${t.value}`}
                      tabIndex={state.target === t.value ? 0 : -1}
                      type="button"
                      role="radio"
                      aria-checked={state.target === t.value}
                      title={t.hint}
                      onClick={() => set({ target: t.value as Target })}
                      className="min-h-11 rounded-[var(--radius)] border border-[var(--border-strong)] px-3 text-[length:var(--t-sm)] aria-checked:border-[var(--accent)] aria-checked:bg-[var(--accent)] aria-checked:text-[var(--accent-text)]"
                    >
                      {t.label} · {t.value}
                    </button>
                  ))}
                </div>
              </fieldset>
              <span className="grow" />
              <TextBtn onClick={swap}>Swap</TextBtn>
              <TextBtn onClick={share}>Copy share link</TextBtn>
              <TextBtn onClick={reset}>Reset example</TextBtn>
            </div>
          </section>

          <section
            aria-labelledby="verdict"
            className={`mt-8 transition-opacity duration-[var(--dur-state)] ${stale ? 'opacity-50' : ''}`}
          >
            <h2 id="verdict" className="sr-only">
              Result
            </h2>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-[var(--text)] pt-4">
              <p className="tnum text-[length:var(--t-3xl)] leading-none font-semibold">
                {show(ratio)}
                <span className="text-[length:var(--t-lg)] text-[var(--text-muted)]"> : 1</span>
              </p>
              <p
                className={`text-[length:var(--t-lg)] font-medium ${passes ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}
              >
                {passes ? `Passes ${state.target} : 1` : `Needs ${state.target} : 1`}
              </p>
            </div>
            {stale && (
              <p className="mt-2 text-[length:var(--t-sm)] text-[var(--text-muted)]">
                Showing your last valid pair until both colours parse.
              </p>
            )}

            {outcome.status === 'passes' && (
              <p className="mt-4 max-w-prose text-[var(--text-muted)]">
                This pair already clears the target, so there is nothing to fix. Try the AAA
                target, or paste a pair that is giving you trouble.
              </p>
            )}

            {outcome.status === 'impossible' && (
              <p className="mt-4 max-w-prose text-[var(--text)]">
                Neither colour can reach {state.target} : 1 against the other by lightness
                alone. The two are too close in brightness at the extremes. Change one of them
                to something much lighter or darker, or pick a lower target.
              </p>
            )}

            {outcome.status === 'fixable' && (
              <>
                {outcome.impossible.length > 0 && (
                  <p className="mt-4 max-w-prose text-[var(--text-muted)]">
                    The {outcome.impossible.join(' and ')} cannot reach {state.target} : 1 on
                    its own — only the other colour can move.
                  </p>
                )}
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {outcome.fixes.map((f, i) => (
                    <div key={f.role}>
                      {i === 0 && outcome.fixes.length > 1 && (
                        <p className="mb-2 text-[length:var(--t-xs)] font-medium tracking-wide text-[var(--accent)] uppercase">
                          Smallest change
                        </p>
                      )}
                      <FixCard
                        fix={f}
                        fg={fg}
                        bg={bg}
                        target={state.target}
                        onUse={use}
                        onCopy={copy}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <p
            role="status"
            className="mt-4 min-h-6 text-[length:var(--t-sm)] text-[var(--text-muted)]"
          >
            {status}
          </p>

          <section aria-labelledby="how" id="how-it-works" className="mt-12 max-w-prose">
            <h2 id="how" className="text-[length:var(--t-xl)] font-semibold">
              How it works
            </h2>
            <p className="mt-3 text-[var(--text-muted)]">
              Most fixers nudge RGB or HSL lightness, which drifts the hue — orange turns brown,
              blue turns purple. Huekeep works in OKLCH, where lightness is perceptual and hue
              is independent. It holds the hue and chroma, walks lightness away from where you
              started in both directions, and stops at the first step whose 8-bit result truly
              clears the ratio. It then offers whichever of text or background moves least. If a
              lightness cannot be as vivid inside sRGB, saturation drops, hue never does.
            </p>
            <p className="mt-3 text-[var(--text-muted)]">
              Contrast is the WCAG 2.x formula (the one accessibility law and audits cite).
              Alpha is not supported: contrast depends on what is behind a transparent colour.
            </p>
          </section>
        </main>

        <footer className="border-t border-[var(--border)] py-6 text-sm text-[var(--text-faint)]">
          <p>
            Runs entirely in your browser and works offline. Your colours never leave this
            device.{' '}
            <a
              className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
              href="https://github.com/oliverinhalo/huekeep"
            >
              Source
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}

function TextBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-[var(--radius)] px-3 text-[length:var(--t-sm)] text-[var(--text-muted)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--text)]"
    >
      {children}
    </button>
  );
}
