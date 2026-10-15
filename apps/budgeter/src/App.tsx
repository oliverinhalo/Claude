import { useMemo, useState } from 'react';
import { ThemeToggle } from './components/ThemeToggle';
import { NumberField } from './components/NumberField';
import { ExpenseRow } from './components/ExpenseRow';
import { PayStrip, type Segment } from './components/PayStrip';
import { usePlan } from './lib/usePlan';
import { blankExpense, encodePlan, MAX_EXPENSES } from './lib/plan';
import { calculatePay, LOAN_LABELS, LOAN_THRESHOLDS, type LoanPlan } from './lib/tax';
import { totalMonthly } from './lib/expenses';
import { gbp, gbpExact } from './lib/format';

export function App() {
  const { plan, notice, update, reset, dismissNotice } = usePlan();
  const [shareMsg, setShareMsg] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const pay = useMemo(() => calculatePay(plan), [plan]);
  const spendMonthly = totalMonthly(plan.expenses);
  const takeHomeMonthly = pay.takeHome / 12;
  const left = takeHomeMonthly - spendMonthly;
  const short = left < 0;

  const raise = useMemo(() => {
    const next = calculatePay({ ...plan, salary: plan.salary + 1000 });
    return next.takeHome - pay.takeHome;
  }, [plan, pay.takeHome]);

  const spendYearly = Math.min(spendMonthly * 12, pay.takeHome);
  const segments: Segment[] = [
    { key: 'tax', label: 'Income tax', yearly: pay.tax },
    { key: 'ni', label: 'National Insurance', yearly: pay.ni },
    { key: 'loan', label: 'Student loan', yearly: pay.loan },
    { key: 'pension', label: 'Pension', yearly: pay.pension },
    { key: 'spend', label: 'Your spending', yearly: spendYearly },
    {
      key: 'left',
      label: 'Left over',
      yearly: pay.takeHome - spendYearly,
    },
  ];

  async function share() {
    const url = `${window.location.origin}${window.location.pathname}#p=${encodePlan(plan)}`;
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copied. Anyone who opens it sees this plan.');
    } catch {
      setShareMsg('Copy this link to share the plan:');
    }
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 sm:px-6">
        <header className="flex items-center justify-between gap-4 py-6">
          <span className="wordmark">Budgeter</span>
          <ThemeToggle />
        </header>

        <main id="main" className="flex-1 pb-12">
          <h1 className="h1">Your salary, after the taxman and after your spending.</h1>
          <p className="lede">
            Enter what you earn and what you spend. Budgeter shows what lands in your account
            each month and what is left. Nothing leaves your device.
          </p>

          {notice ? (
            <p className="notice" role="status">
              {notice}{' '}
              <button type="button" className="link-btn" onClick={dismissNotice}>
                Dismiss
              </button>
            </p>
          ) : null}

          <section aria-labelledby="pay-h" className="block">
            <h2 id="pay-h" className="h2">
              Your pay
            </h2>
            <div className="pay-grid">
              <NumberField
                label="Annual salary before tax"
                prefix="£"
                value={plan.salary}
                onCommit={(salary) => update({ salary })}
              />
              <NumberField
                label="Pension contribution"
                suffix="%"
                max={100}
                value={plan.pensionPct}
                onCommit={(pensionPct) => update({ pensionPct })}
                hint="Taken before tax."
              />
              <div className="field">
                <label htmlFor="loan" className="field-label">
                  Student loan
                </label>
                <select
                  id="loan"
                  className="plain-input boxed"
                  value={plan.loan}
                  onChange={(e) => update({ loan: e.target.value as LoanPlan })}
                >
                  {(Object.keys(LOAN_LABELS) as LoanPlan[]).map((k) => (
                    <option key={k} value={k}>
                      {k === 'none'
                        ? LOAN_LABELS[k]
                        : `${LOAN_LABELS[k]} (over ${gbp(LOAN_THRESHOLDS[k])})`}
                    </option>
                  ))}
                </select>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={plan.postgrad}
                  onChange={(e) => update({ postgrad: e.target.checked })}
                />
                Postgraduate loan (6% over £21,000)
              </label>
            </div>
          </section>

          <section aria-labelledby="result-h" className="block result" aria-live="polite">
            <h2 id="result-h" className="h2">
              What you take home
            </h2>
            <p className="big tnum" data-testid="takehome-month">
              {gbpExact(takeHomeMonthly)}
              <span className="big-unit"> a month</span>
            </p>
            <p className="sub tnum">
              {gbp(pay.takeHome)} a year · {gbpExact(pay.takeHome / 52)} a week
            </p>
            <p className="sub tnum">
              A £1,000 raise would add {gbp(raise)} to your take-home
              {raise > 0 ? ` (${Math.round((raise / 1000) * 100)}p in the pound).` : '.'}
            </p>
          </section>

          <section aria-labelledby="exp-h" className="block">
            <h2 id="exp-h" className="h2">
              Your spending
            </h2>
            {plan.expenses.length === 0 ? (
              <p className="empty">
                Nothing spent yet. Add the things you pay for regularly: lunch, rent, the gym.
              </p>
            ) : (
              <ul className="expenses">
                {plan.expenses.map((e, i) => (
                  <ExpenseRow
                    key={e.id}
                    expense={e}
                    index={i}
                    onChange={(next) =>
                      update((p) => ({
                        expenses: p.expenses.map((x) => (x.id === e.id ? next : x)),
                      }))
                    }
                    onRemove={() =>
                      update((p) => ({ expenses: p.expenses.filter((x) => x.id !== e.id) }))
                    }
                  />
                ))}
              </ul>
            )}
            <button
              type="button"
              className="btn"
              disabled={plan.expenses.length >= MAX_EXPENSES}
              onClick={() => update((p) => ({ expenses: [...p.expenses, blankExpense()] }))}
            >
              Add an expense
            </button>
            {plan.expenses.length >= MAX_EXPENSES ? (
              <p className="field-msg">That is the limit of {MAX_EXPENSES} expenses.</p>
            ) : null}
          </section>

          <section aria-labelledby="left-h" className="block result" aria-live="polite">
            <h2 id="left-h" className="h2">
              What is left
            </h2>
            <p className={`big tnum${short ? ' bad' : ''}`} data-testid="left-month">
              {short ? `${gbpExact(-left)} short` : gbpExact(left)}
              <span className="big-unit"> a month</span>
            </p>
            <p className="sub tnum">
              {gbpExact(takeHomeMonthly)} take-home − {gbpExact(spendMonthly)} spending
              {short ? '. You are spending more than you take home.' : '.'}
            </p>
          </section>

          <section aria-labelledby="strip-h" className="block">
            <h2 id="strip-h" className="h2">
              Where {gbp(pay.gross)} goes
            </h2>
            <PayStrip segments={segments} gross={pay.gross} />
          </section>

          <section aria-labelledby="share-h" className="block">
            <h2 id="share-h" className="h2">
              Keep or share this plan
            </h2>
            <div className="row">
              <button type="button" className="btn" onClick={share}>
                Copy link to this plan
              </button>
              <button type="button" className="btn btn-quiet" onClick={reset}>
                Reset to the example
              </button>
            </div>
            <p className="field-msg" role="status">
              {shareMsg}
            </p>
            {shareUrl ? (
              <input
                className="plain-input boxed url"
                readOnly
                aria-label="Plan link"
                value={shareUrl}
              />
            ) : null}
          </section>

          <section aria-labelledby="basis-h" className="block basis">
            <h2 id="basis-h" className="h2">
              How this is worked out
            </h2>
            <p>
              2026/27 rates for England, Wales and Northern Ireland, standard tax code 1257L:
              personal allowance £12,570 (reduced above £100,000), 20% on the next £37,700, 40%
              to £125,140, 45% above; National Insurance 8% from £12,570 to £50,270 and 2%
              above. Pension is taken before tax. Student loans are 9% above the plan threshold.
              Daily spending is multiplied by the days you tick, 52 weeks a year, then divided
              by 12. These are estimates, not payroll. Scottish rates, bonuses and benefits are
              not included.
            </p>
          </section>
        </main>

        <footer className="border-t border-[var(--border)] py-6 text-sm text-[var(--text-faint)]">
          <p>
            Runs entirely in your browser and works offline once loaded. Your figures are kept
            on this device only.{' '}
            <a
              className="underline decoration-[var(--border-strong)] underline-offset-2 hover:text-[var(--text)]"
              href="https://github.com/oliverinhalo/budgeter"
            >
              Source
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
