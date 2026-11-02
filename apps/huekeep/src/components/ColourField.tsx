import { useId } from 'react';
import { parseColor, toHex } from '../lib/color';

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error: string | null;
}

/** A text field that accepts any CSS colour form, plus the native picker. */
export function ColourField({ label, value, onChange, error }: Props) {
  const id = useId();
  const parsed = parseColor(value);
  const pickerValue = parsed.ok ? toHex(parsed.rgb) : '#000000';
  return (
    <div>
      <label htmlFor={id} className="block text-[length:var(--t-sm)] font-medium">
        {label}
      </label>
      <div className="mt-2 flex items-stretch gap-2">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          inputMode="text"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help`}
          className="min-h-11 min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 font-mono text-[length:var(--t-base)] text-[var(--text)] aria-[invalid=true]:border-[var(--danger)]"
        />
        <label className="relative block min-h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-[var(--radius)] border border-[var(--border-strong)]">
          <span className="sr-only">{label} — open colour picker</span>
          <input
            type="color"
            value={pickerValue}
            onChange={(e) => onChange(e.target.value)}
            className="absolute -inset-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
      </div>
      <p
        id={`${id}-help`}
        className={`mt-2 min-h-5 text-[length:var(--t-xs)] ${error ? 'text-[var(--danger)]' : 'text-[var(--text-faint)]'}`}
      >
        {error ?? 'Hex, rgb() or hsl() — paste anything from your CSS.'}
      </p>
    </div>
  );
}
