import { useCallback, useMemo, useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { TokenSetup } from './components/TokenSetup';
import { Overview } from './components/Overview';
import { AppsView } from './components/AppsView';
import { IdeasView } from './components/IdeasView';
import { ControlView } from './components/ControlView';
import { createClient, readRepo, readToken, writeRepo, writeToken } from './lib/github';
import { useFactory } from './lib/useFactory';

const TABS = ['Overview', 'Apps', 'Ideas', 'Control'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [token, setToken] = useState<string | null>(readToken);
  const [repo, setRepo] = useState<string>(readRepo);
  const [tab, setTab] = useState<Tab>('Overview');

  const [wantsToken, setWantsToken] = useState(false);
  // Reading a public repo needs no token, so the dashboard loads straight away.
  // A token is required only to write, or to read a private repository.
  const client = useMemo(() => createClient(token, repo), [token, repo]);
  const { state, refreshing, reload } = useFactory(client);

  const connect = useCallback((nextToken: string, nextRepo: string) => {
    writeToken(nextToken);
    writeRepo(nextRepo);
    setRepo(nextRepo);
    setToken(nextToken);
    setWantsToken(false);
  }, []);

  const disconnect = useCallback(() => {
    writeToken(null);
    setToken(null);
  }, []);

  // A rejected token, an unreadable private repo, or an explicit request to
  // connect all lead to the one screen that fixes it.
  if (
    wantsToken ||
    (state.status === 'error' && /rejected|cannot see|private|Not found/i.test(state.message))
  ) {
    return (
      <>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <TokenSetup
          onSubmit={connect}
          initialRepo={repo}
          {...(state.status === 'error' ? { error: state.message } : {})}
          {...(wantsToken ? { onCancel: () => setWantsToken(false) } : {})}
        />
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="mx-auto flex min-h-dvh max-w-4xl flex-col px-4 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3 py-6">
          <div>
            <h1 className="text-[length:var(--t-xl)] leading-none font-semibold tracking-tight">
              Factory Console
            </h1>
            <p className="mt-1 font-mono text-sm text-[var(--text-faint)]">{repo}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void reload()}
              disabled={state.status === 'loading' || refreshing}
              className="inline-flex min-h-11 items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--text-muted)] transition-colors duration-[var(--dur-state)] hover:border-[var(--border-strong)] hover:text-[var(--text)] disabled:opacity-50"
            >
              {state.status === 'loading' || refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <ThemeToggle />
          </div>
        </header>

        <nav
          aria-label="Sections"
          className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--border)]"
        >
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              aria-current={tab === name ? 'page' : undefined}
              className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors duration-[var(--dur-state)] ${
                tab === name
                  ? 'border-[var(--accent)] text-[var(--text)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {name}
            </button>
          ))}
        </nav>

        <main id="main" className="flex-1 py-8">
          {state.status === 'loading' || state.status === 'idle' ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading the factory">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-sunken)]"
                />
              ))}
            </div>
          ) : state.status === 'error' ? (
            <div
              role="alert"
              className="rounded-[var(--radius-lg)] border border-[var(--danger)] p-5"
            >
              <p className="font-medium text-[var(--danger)]">Could not load the factory</p>
              <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-text)]"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-4 text-sm"
                >
                  Use a different token
                </button>
              </div>
            </div>
          ) : tab === 'Overview' ? (
            <Overview data={state.data} />
          ) : tab === 'Apps' ? (
            <AppsView apps={state.data.ledger.apps} />
          ) : tab === 'Ideas' ? (
            <IdeasView
              bank={state.data.bank}
              submitted={state.data.submitted}
              client={client}
              onConnect={() => setWantsToken(true)}
              onChanged={() => void reload()}
            />
          ) : (
            <ControlView
              client={client}
              onConnect={() => setWantsToken(true)}
              requests={state.data.requests}
              runs={state.data.runs}
              reports={state.data.reports}
              onChanged={() => void reload()}
            />
          )}
        </main>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] py-6 text-sm text-[var(--text-faint)]">
          <span>
            {client.canWrite
              ? 'Your token stays in this browser.'
              : 'Browsing anonymously — connect to add ideas or send instructions.'}
          </span>
          <a
            className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noreferrer"
          >
            Factory repo ↗
          </a>
          <button
            type="button"
            onClick={client.canWrite ? disconnect : () => setWantsToken(true)}
            className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
          >
            {client.canWrite ? 'Disconnect' : 'Connect'}
          </button>
        </footer>
      </div>
    </>
  );
}
