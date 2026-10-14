import { useEffect, useId, useMemo, useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { Strip } from './components/Strip';
import { analyse, suggestSafe, type ChangeReport } from './lib/plan';
import { buildHash, EXAMPLE, initialState, isState, type State } from './lib/share';
import { createStore } from './lib/storage';
import { formatClock, formatDate, formatUtc, offsetLabel } from './lib/format';
import { allZones } from './lib/zone';

const MINUTE = 60_000;
const store = createStore<State>({
  key: 'cronlens:state',
  version: 1,
  fallback: { ...EXAMPLE },
  validate: isState,
});

const EXAMPLES: { label: string; expr: string; zone: string }[] = [
  { label: 'Nightly backup, New York', expr: '30 2 * * *', zone: 'America/New_York' },
  { label: 'Nightly report, London', expr: '30 1 * * *', zone: 'Europe/London' },
  { label: 'Every 15 minutes, Lord Howe', expr: '*/15 * * * *', zone: 'Australia/Lord_Howe' },
  { label: 'Weekday stand-up, Berlin', expr: '0 9 * * 1-5', zone: 'Europe/Berlin' },
];

function verdictFor(
  total: number,
  hazards: number,
  zone: string,
): { text: string; tone: 'safe' | 'hazard' } {
  if (total === 0) {
    return {
      text: `Clock changes in ${zone} in the next 12 months: none. Nothing here can skip or repeat a run.`,
      tone: 'safe',
    };
  }
  if (hazards === 0) {
    return {
      text: `Clock changes that skip or repeat a run: none. All ${total} upcoming ${total === 1 ? 'change misses' : 'changes miss'} this schedule.`,
      tone: 'safe',
    };
  }
  return {
    text: `${hazards} of the ${total} upcoming clock ${total === 1 ? 'change' : 'changes'} ${hazards === 1 ? 'skips or repeats' : 'skip or repeat'} a run of this schedule.`,
    tone: 'hazard',
  };
}

function ChangeCard({ report }: { report: ChangeReport }) {
  const { change, affected } = report;
  const skipped = change.kind === 'skipped';
  const last = formatClock(change.from - MINUTE);
  const shownTimes = affected.slice(0, 6).map((a) => formatClock(a.wall));
  const more = affected.length - shownTimes.length;
  return (
    <li className="card" data-hazard={affected.length > 0 ? 'true' : 'false'}>
      <h3 className="card-title">
        <span className="tnum">{formatDate(skipped ? change.from : change.to - 1)}</span>
        <span className="card-kind">{skipped ? 'clocks go forward' : 'clocks go back'}</span>
      </h3>
      <p className="mono tnum card-sub">
        {formatClock(change.from)}
        {skipped ? ' → ' : ' ← '}
        {formatClock(change.to)} · {offsetLabel(change.offsetBefore)} →{' '}
        {offsetLabel(change.offsetAfter)}
      </p>
      <Strip report={report} />
      {affected.length === 0 ? (
        <p className="effect effect-ok">
          Nothing in this schedule falls in the {skipped ? 'skipped' : 'repeated'} time.
        </p>
      ) : skipped ? (
        <p className="effect">
          <strong className="mono tnum">
            {shownTimes.join(', ')}
            {more > 0 ? ` and ${more} more` : ''}
          </strong>{' '}
          {affected.length === 1 ? 'does not exist' : 'do not exist'} that day: the clock goes
          from {last} to {formatClock(change.to)}.
        </p>
      ) : (
        <p className="effect">
          <strong className="mono tnum">
            {shownTimes.join(', ')}
            {more > 0 ? ` and ${more} more` : ''}
          </strong>{' '}
          {affected.length === 1 ? 'happens' : 'happen'} twice that day: once at{' '}
          {offsetLabel(change.offsetBefore)}, again at {offsetLabel(change.offsetAfter)}.
        </p>
      )}
    </li>
  );
}

export function App() {
  const ids = { expr: useId(), note: useId(), zone: useId() };
  const zones = useMemo(() => allZones(), []);
  const [initial] = useState(() => initialState(window.location.hash, store.load().value));
  const [expr, setExpr] = useState(initial.state.expr);
  const [zone, setZone] = useState(initial.state.zone);
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [now] = useState(() => Date.now());

  const result = useMemo(() => analyse(expr, zone, now), [expr, zone, now]);

  useEffect(() => {
    if (!result.ok) return;
    store.save({ expr, zone });
    window.history.replaceState(null, '', buildHash({ expr, zone }));
  }, [result.ok, expr, zone]);

  useEffect(() => {
    const onHash = () => {
      const next = initialState(window.location.hash, { expr, zone });
      setExpr(next.state.expr);
      setZone(next.state.zone);
      setNotice(next.notice);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [expr, zone]);

  const suggestion = useMemo(
    () => (result.ok ? suggestSafe(expr, zone, now) : null),
    [result.ok, expr, zone, now],
  );

  const zoneOptions = zones.includes(zone) ? zones : [zone, ...zones];

  async function copyLink() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Link copied. It carries the expression and the time zone.');
    } catch {
      setNotice(`Copy this link: ${url}`);
    }
  }

  const analysis = result.ok ? result.analysis : null;
  const verdict = analysis
    ? verdictFor(analysis.changes.length, analysis.hazardCount, zone)
    : null;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="shell">
        <header className="top">
          <span className="wordmark mono">
            cron<span aria-hidden="true">·</span>lens
          </span>
          <ThemeToggle />
        </header>

        <main id="main" className="main">
          <h1 className="h1">Will your cron job survive the clocks changing?</h1>
          <p className="lede">
            Paste a schedule and pick a time zone. Cronlens finds the runs that fall in the hour
            that disappears in spring, or the hour that happens twice in autumn.
          </p>

          <form className="panel" onSubmit={(e) => e.preventDefault()}>
            <div className="field">
              <label htmlFor={ids.expr}>Cron expression</label>
              <input
                id={ids.expr}
                className="mono input-expr"
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                aria-invalid={result.ok ? undefined : true}
                aria-describedby={ids.note}
                placeholder="30 2 * * *"
              />
              <p id={ids.note} className={result.ok ? 'note' : 'note note-error'}>
                {result.ok
                  ? 'Five fields: minute, hour, day of month, month, day of week.'
                  : result.error}
              </p>
            </div>
            <div className="field">
              <label htmlFor={ids.zone}>Time zone</label>
              <select
                id={ids.zone}
                className="input-zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              >
                {zoneOptions.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="chips" role="group" aria-label="Try an example">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setExpr(ex.expr);
                    setZone(ex.zone);
                    setNotice(null);
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </form>

          <div role="status" className="notice">
            {notice}
          </div>

          {analysis && verdict && (
            <>
              <section aria-labelledby="verdict" className="verdict" data-tone={verdict.tone}>
                <h2 id="verdict" className="verdict-text">
                  {verdict.text}
                </h2>
                <p className="mono reading">{analysis.description}</p>
                {suggestion && (
                  <p className="suggest">
                    Nearest safe time: <strong className="mono tnum">{suggestion.expr}</strong>,
                    which is {Math.abs(suggestion.shiftHours)}{' '}
                    {Math.abs(suggestion.shiftHours) === 1 ? 'hour' : 'hours'}{' '}
                    {suggestion.shiftHours > 0 ? 'later' : 'earlier'}. No clock change in the
                    next 12 months skips or repeats it.{' '}
                    <button
                      type="button"
                      className="btn btn-inline"
                      onClick={() => {
                        setExpr(suggestion.expr);
                        setNotice(`Schedule changed to ${suggestion.expr}.`);
                      }}
                    >
                      Use this schedule
                    </button>
                  </p>
                )}
                <button type="button" className="btn" onClick={copyLink}>
                  Copy link to this check
                </button>
              </section>

              <section aria-labelledby="changes">
                <h2 id="changes" className="h2">
                  Clock changes in the next 12 months
                </h2>
                {analysis.changes.length === 0 ? (
                  <p className="empty">
                    {zone} keeps the same offset all year, so every run happens exactly once, at
                    the time written.
                  </p>
                ) : (
                  <ul className="cards">
                    {analysis.changes.map((c) => (
                      <ChangeCard key={c.change.at} report={c} />
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="runs">
                <h2 id="runs" className="h2">
                  {analysis.runs.length === 10 ? 'Next ten runs' : 'Upcoming runs'}
                </h2>
                {analysis.neverRuns ? (
                  <p className="empty">
                    No run in the next eight years. Check the day-of-month and month: something
                    like 31 February never happens.
                  </p>
                ) : (
                  <div
                    className="table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label="Next runs, scrollable"
                  >
                    <table className="runs">
                      <thead>
                        <tr>
                          <th scope="col">Local time in {zone.replace(/_/g, ' ')}</th>
                          <th scope="col">Offset</th>
                          <th scope="col">UTC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.runs.map((r, i) => (
                          <tr key={`${r.instant}-${i}`}>
                            <td className="mono tnum">
                              {formatDate(r.wall)} {formatClock(r.wall)}
                            </td>
                            <td className="mono tnum">{offsetLabel(r.offset)}</td>
                            <td className="mono tnum">{formatUtc(r.instant)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          <section aria-labelledby="how" className="how" id="how-it-works">
            <h2 id="how" className="h2">
              How it works
            </h2>
            <p>
              A wall clock reading is not the same thing as a moment. When clocks go forward,
              readings like 02:30 never happen. When they go back, 01:30 happens twice. Cronlens
              asks your browser's time zone data where each change falls, then checks every
              minute of the missing or repeated hour against your schedule.
            </p>
            <p>
              It reports facts about the clock, not about your scheduler. Vixie cron, systemd
              timers, Kubernetes CronJobs and cloud schedulers each handle these runs
              differently, so check yours. The safest fixes are the same everywhere: run in UTC,
              or keep the job out of the hours around 01:00 to 03:00 local time.
            </p>
            <p>
              Day-of-month and day-of-week follow classic cron: if both are restricted, a day
              matches when either does. Quartz syntax (seconds, <span className="mono">?</span>,{' '}
              <span className="mono">L</span>, <span className="mono">#</span>) is not
              supported.
            </p>
          </section>
        </main>

        <footer className="foot">
          <p>
            Runs entirely in your browser: nothing you type is sent anywhere, and it needs no
            network after the page loads.{' '}
            <a href="https://github.com/oliverinhalo/cronlens">Source</a>
          </p>
        </footer>
      </div>
    </>
  );
}
