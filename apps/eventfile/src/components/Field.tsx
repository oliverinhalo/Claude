import type { ReactNode } from 'react';
import type { FieldError } from '../lib/model';

export const inputCls =
  'min-h-11 w-full rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-[var(--text)] transition-colors duration-[var(--dur-state)] hover:border-[var(--text-faint)] aria-[invalid=true]:border-[var(--danger)]';

interface Props {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: FieldError | undefined;
  children: (p: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string | undefined;
  }) => ReactNode;
}

export function Field({ id, label, hint, error, children }: Props) {
  const describedBy = [error ? `${id}-err` : '', hint ? `${id}-hint` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy || undefined,
      })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-[var(--text-faint)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="text-sm font-medium text-[var(--danger)]">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
