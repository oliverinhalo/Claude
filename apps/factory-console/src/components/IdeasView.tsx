import { useMemo, useState } from 'react';
import type { Client } from '../lib/github';
import { groupByCategory, matches, relative } from '../lib/parse';
import type { Idea } from '../lib/types';

interface Props {
  bank: Idea[];
  submitted: Idea[];
  client: Client;
  onConnect: () => void;
  onChanged: () => void;
}

export function IdeasView({ bank, submitted, client, onConnect, onChanged }: Props) {
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sent, setSent] = useState<number | null>(null);

  const filtered = useMemo(() => bank.filter((i) => matches(i, query)), [bank, query]);
  const groups = useMemo(() => groupByCategory(filtered), [filtered]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const issue = await client.createIssue(
        name.trim(),
        [
          detail.trim() || '_No further detail given._',
          '',
          '---',
          'Submitted from the Factory Console. The next factory run reads open issues',
          'labelled `idea` and scores them against the rubric alongside its own candidates.',
        ].join('\n'),
        ['idea'],
      );
      setSent(issue.number);
      setName('');
      setDetail('');
      onChanged();
    } catch (error) {
      setProblem(
        error instanceof Error
          ? `Could not save that idea: ${error.message}`
          : 'Could not save that idea.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function prioritise(issue: number) {
    try {
      await client.addLabel(issue, 'next');
      onChanged();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not prioritise that idea.');
    }
  }

  async function withdraw(issue: number) {
    try {
      await client.closeIssue(issue);
      onChanged();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Could not withdraw that idea.');
    }
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="add-heading">
        <h2 id="add-heading" className="text-[length:var(--t-lg)] font-semibold">
          Add your own idea
        </h2>
        <p className="mt-1 max-w-prose text-[var(--text-muted)] text-pretty">
          It goes straight into the factory's queue. The next run scores it against the same
          rubric as its own candidates — marking one{' '}
          <strong className="font-medium text-[var(--text)]">Build next</strong> makes it the
          one chosen, as long as it clears the quality bar.
        </p>

        <form className="mt-4 space-y-3" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium" htmlFor="idea-name">
              What is it called?
            </label>
            <input
              id="idea-name"
              className="mt-1.5 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-3"
              placeholder="Shift swap planner"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="idea-detail">
              Who is it for, and what does it do?{' '}
              <span className="font-normal text-[var(--text-faint)]">Optional</span>
            </label>
            <textarea
              id="idea-detail"
              className="mt-1.5 min-h-24 w-full resize-y rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2"
              placeholder="A nurse swapping shifts needs to see whose rota it actually fits, without a group chat."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              maxLength={4000}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {client.canWrite ? (
              <button
                type="submit"
                disabled={!name.trim() || busy}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Sending…' : 'Send to the factory'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                className="min-h-11 rounded-[var(--radius)] bg-[var(--accent)] px-5 font-medium text-[var(--accent-text)] transition-opacity duration-[var(--dur-state)] hover:opacity-90"
              >
                Connect to send this
              </button>
            )}
            {sent !== null ? (
              <p role="status" className="text-sm text-[var(--success)]">
                Queued as #{sent}. The next run will see it.
              </p>
            ) : null}
          </div>
          {problem ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {problem}
            </p>
          ) : null}
        </form>
      </section>

      {submitted.length > 0 ? (
        <section aria-labelledby="yours-heading">
          <h2 id="yours-heading" className="text-[length:var(--t-lg)] font-semibold">
            Your ideas in the queue
          </h2>
          <ul className="mt-3 space-y-2">
            {submitted.map((idea) => (
              <li
                key={idea.issue}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3"
              >
                <div className="min-w-48 flex-1">
                  <p className="font-medium">
                    {idea.name}
                    {idea.state === 'next' ? (
                      <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-sm font-normal text-[var(--accent-text)]">
                        build next
                      </span>
                    ) : null}
                  </p>
                  {idea.description ? (
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {idea.description}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-sm text-[var(--text-faint)]">
                    added {idea.createdAt ? relative(idea.createdAt) : 'recently'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {idea.state !== 'next' && idea.issue !== undefined ? (
                    <button
                      type="button"
                      onClick={() => void prioritise(idea.issue as number)}
                      className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm transition-colors duration-[var(--dur-state)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      Build next
                    </button>
                  ) : null}
                  {idea.issue !== undefined ? (
                    <button
                      type="button"
                      onClick={() => void withdraw(idea.issue as number)}
                      className="min-h-11 rounded-[var(--radius)] border border-[var(--border)] px-3 text-sm text-[var(--text-muted)] transition-colors duration-[var(--dur-state)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                      Withdraw
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="bank-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="bank-heading" className="text-[length:var(--t-lg)] font-semibold">
            The idea bank
          </h2>
          <p className="text-sm text-[var(--text-faint)] tnum">
            {filtered.length} of {bank.length}
          </p>
        </div>
        <p className="mt-1 text-[var(--text-muted)]">
          Candidates the factory keeps on hand. Nothing is deleted — a rejected idea this week
          is a shortlist entry in month seven.
        </p>

        <label className="sr-only" htmlFor="idea-search">
          Search ideas
        </label>
        <input
          id="idea-search"
          type="search"
          className="mt-4 min-h-11 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-raised)] px-3"
          placeholder="Search by name, description or category"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {groups.length === 0 ? (
          <p className="mt-6 text-[var(--text-muted)]">
            Nothing matches “{query}”. Try a broader word — or add it as a new idea above.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {groups.map(([category, ideas]) => (
              <div key={category}>
                <h3 className="text-sm font-medium tracking-wide text-[var(--text-faint)] uppercase">
                  {category} <span className="tnum">({ideas.length})</span>
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {ideas.map((idea) => (
                    <li key={`${category}-${idea.name}`} className="text-pretty">
                      <span
                        className={
                          idea.state === 'done' ? 'line-through opacity-60' : 'font-medium'
                        }
                      >
                        {idea.name}
                      </span>
                      <span className="text-[var(--text-muted)]"> — {idea.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
