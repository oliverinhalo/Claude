import { ThemeToggle } from './components/ThemeToggle';

/**
 * The application shell.
 *
 * Phase 5 replaces the contents of <main>. Keep the landmarks, the skip link,
 * the single h1, and the footer — the accessibility gate depends on them.
 */
export function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-6">
          <span className="font-mono text-sm tracking-tight text-[var(--text-faint)]">
            __APP_SLUG__
          </span>
          <ThemeToggle />
        </header>

        <main id="main" className="flex-1 py-8">
          <h1 className="text-[length:var(--t-3xl)] leading-tight font-semibold tracking-tight text-balance">
            __APP_NAME__
          </h1>
          <p className="mt-4 max-w-prose text-[length:var(--t-lg)] text-[var(--text-muted)] text-pretty">
            __APP_DESCRIPTION__
          </p>

          <section
            aria-labelledby="start-here"
            className="mt-10 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-sm)]"
          >
            <h2 id="start-here" className="text-[length:var(--t-lg)] font-semibold">
              Scaffold ready
            </h2>
            <p className="mt-2 text-[var(--text-muted)]">
              Strict TypeScript, design tokens with a real dark mode, versioned local
              persistence that survives corrupt data, unit tests, an end-to-end smoke
              test, and an accessibility audit are all wired up. Build the core loop from{' '}
              <code className="font-mono text-sm">docs/SPEC.md</code>, then replace this
              section.
            </p>
          </section>
        </main>

        <footer className="border-t border-[var(--border)] py-6 text-sm text-[var(--text-faint)]">
          <p>
            Runs entirely in your browser. Your data never leaves this device.{' '}
            <a
              className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
              href="https://github.com/__OWNER__/__APP_SLUG__"
            >
              Source
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
