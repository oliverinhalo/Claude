import { parseDate } from '../lib/dates';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The signature detail: a tear-off calendar leaf showing the first occurrence. */
export function Leaf({ iso }: { iso: string | undefined }) {
  const d = iso ? parseDate(iso) : null;
  return (
    <div
      aria-hidden="true"
      className="relative flex w-20 shrink-0 flex-col items-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[var(--shadow)]"
    >
      <div className="w-full bg-[var(--accent)] py-1 text-center font-mono text-xs tracking-widest text-[var(--accent-text)] uppercase">
        {d ? MONTHS[d.getUTCMonth()] : '---'}
      </div>
      <div className="font-serif text-[length:var(--t-2xl)] leading-none font-semibold pt-2">
        {d ? d.getUTCDate() : '–'}
      </div>
      <div className="pb-2 font-mono text-xs text-[var(--text-faint)]">
        {d ? DAYS[d.getUTCDay()] : ''}
      </div>
    </div>
  );
}
