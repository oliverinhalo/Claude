import { useId, useState } from 'react';
import { parseMoney } from '../lib/expenses';
import { plainNumber } from '../lib/format';

interface Props {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  prefix?: string;
  suffix?: string;
  max?: number;
  /** Visually hide the label (the control is still named). */
  hideLabel?: boolean;
  hint?: string;
  inputClassName?: string;
}

/** A money-or-percent input that keeps what the user typed until it is valid. */
export function NumberField({
  label,
  value,
  onCommit,
  prefix,
  suffix,
  max = 10_000_000,
  hideLabel,
  hint,
  inputClassName,
}: Props) {
  const id = useId();
  const [draft, setDraft] = useState(() => plainNumber(value));
  const [bad, setBad] = useState(false);

  // The plan can change underneath us (Reset, a pasted share link). If the
  // committed value no longer matches what the box says, show the real value.
  if (!bad && parseMoney(draft, max) !== value) {
    setDraft(plainNumber(value));
  }

  function change(text: string) {
    setDraft(text);
    const n = parseMoney(text, max);
    if (n === null) {
      setBad(true);
      return;
    }
    setBad(false);
    onCommit(n);
  }

  const msgId = `${id}-msg`;
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'field-label'}>
        {label}
      </label>
      <div className="field-box" data-invalid={bad || undefined}>
        {prefix ? <span aria-hidden="true">{prefix}</span> : null}
        <input
          id={id}
          className={inputClassName}
          inputMode="decimal"
          autoComplete="off"
          maxLength={14}
          value={draft}
          aria-invalid={bad || undefined}
          aria-describedby={bad || hint ? msgId : undefined}
          onChange={(e) => change(e.target.value)}
          onBlur={() => {
            if (bad) {
              setDraft(plainNumber(value));
              setBad(false);
            }
          }}
        />
        {suffix ? <span aria-hidden="true">{suffix}</span> : null}
      </div>
      {bad ? (
        <p id={msgId} className="field-msg field-msg-bad" role="alert">
          Enter a number from 0 to {max.toLocaleString('en-GB')}. Using {plainNumber(value)} for
          now.
        </p>
      ) : hint ? (
        <p id={msgId} className="field-msg">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
