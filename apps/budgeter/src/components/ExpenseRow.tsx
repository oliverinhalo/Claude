import {
  DAY_NAMES,
  EVERY_LABELS,
  monthlyCost,
  type Every,
  type Expense,
} from '../lib/expenses';
import { gbpExact } from '../lib/format';
import { NumberField } from './NumberField';

interface Props {
  expense: Expense;
  index: number;
  onChange: (next: Expense) => void;
  onRemove: () => void;
}

export function ExpenseRow({ expense: e, index, onChange, onRemove }: Props) {
  const label = e.name.trim() || `Expense ${index + 1}`;
  const none = e.every === 'day' && !e.days.some(Boolean);
  return (
    <li className="expense" data-testid="expense">
      <div className="expense-main">
        <div className="field">
          <label className="sr-only" htmlFor={`name-${e.id}`}>
            Name of {label}
          </label>
          <input
            id={`name-${e.id}`}
            className="plain-input"
            placeholder="What is it? e.g. Lunch"
            maxLength={80}
            value={e.name}
            onChange={(ev) => onChange({ ...e, name: ev.target.value })}
          />
        </div>
        <NumberField
          label={`Amount for ${label}`}
          hideLabel
          prefix="£"
          value={e.amount}
          onCommit={(amount) => onChange({ ...e, amount })}
        />
        <div className="field">
          <label className="sr-only" htmlFor={`every-${e.id}`}>
            How often for {label}
          </label>
          <select
            id={`every-${e.id}`}
            className="plain-input"
            value={e.every}
            onChange={(ev) => onChange({ ...e, every: ev.target.value as Every })}
          >
            {(Object.keys(EVERY_LABELS) as Every[]).map((k) => (
              <option key={k} value={k}>
                {EVERY_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {e.every === 'day' ? (
        <div className="days" role="group" aria-label={`Days for ${label}`}>
          {DAY_NAMES.map((d, i) => (
            <button
              key={d}
              type="button"
              className="day"
              aria-pressed={e.days[i]}
              onClick={() => onChange({ ...e, days: e.days.map((v, j) => (j === i ? !v : v)) })}
            >
              {d}
            </button>
          ))}
        </div>
      ) : null}

      <div className="expense-foot">
        <p className="tnum expense-cost">
          {none ? 'Pick at least one day' : `${gbpExact(monthlyCost(e))} a month`}
        </p>
        <button type="button" className="link-btn" onClick={onRemove}>
          Remove<span className="sr-only"> {label}</span>
        </button>
      </div>
    </li>
  );
}
