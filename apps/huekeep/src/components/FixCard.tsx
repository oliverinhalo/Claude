import type { RGB } from '../lib/color';
import type { Fix, Target } from '../lib/fix';
import { Ribbon } from './Ribbon';

interface Props {
  fix: Fix;
  fg: RGB;
  bg: RGB;
  target: Target;
  onUse: (fix: Fix) => void;
  onCopy: (text: string, what: string) => void;
}

const HEAD = {
  text: 'Change the text colour',
  background: 'Change the background',
} as const;

export function FixCard({ fix, fg, bg, target, onUse, onCopy }: Props) {
  const newFg = fix.role === 'text' ? fix.rgb : fg;
  const newBg = fix.role === 'text' ? bg : fix.rgb;
  const css = fix.role === 'text' ? `color: ${fix.hex};` : `background-color: ${fix.hex};`;
  const size =
    fix.moved < 1
      ? 'barely visible'
      : fix.moved < 4
        ? 'a small shift'
        : fix.moved < 10
          ? 'a clear shift'
          : 'a big shift';
  const rgbCss = (c: RGB) => `rgb(${c.join(' ')})`;

  return (
    <article className="border border-[var(--border-strong)] bg-[var(--surface-raised)] p-4 sm:p-6">
      <h3 className="text-[length:var(--t-lg)] leading-tight font-semibold">
        {HEAD[fix.role]}
      </h3>

      <div className="mt-4 flex flex-wrap items-stretch gap-4">
        <div
          className="flex min-h-20 min-w-40 flex-1 items-center justify-center px-4 py-3 text-[length:var(--t-lg)] font-semibold"
          style={{ color: rgbCss(newFg), background: rgbCss(newBg) }}
        >
          Aa — the quick brown fox
        </div>
        <dl className="tnum grid grid-cols-[auto_auto] items-baseline gap-x-4 gap-y-1 text-[length:var(--t-sm)]">
          <dt className="text-[var(--text-muted)]">New colour</dt>
          <dd className="font-mono text-[length:var(--t-base)] font-semibold">{fix.hex}</dd>
          <dt className="text-[var(--text-muted)]">Contrast</dt>
          <dd>
            {(Math.floor(fix.ratio * 100 + 1e-9) / 100).toFixed(2)} : 1{' '}
            <span className="text-[var(--success)]">✓ {target} : 1</span>
          </dd>
          <dt className="text-[var(--text-muted)]">Moved</dt>
          <dd>
            {fix.direction}, {size}
          </dd>
        </dl>
      </div>

      {fix.chromaReduced && (
        <p className="mt-3 text-[length:var(--t-xs)] text-[var(--text-faint)]">
          Hue held. This lightness cannot be as vivid inside sRGB, so it is slightly less
          saturated.
        </p>
      )}

      <Ribbon
        moving={fix.role === 'text' ? fg : bg}
        fixed={fix.role === 'text' ? bg : fg}
        fixedTo={fix.rgb}
        target={target}
        what={fix.role === 'text' ? 'The text colour' : 'The background'}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn primary onClick={() => onUse(fix)}>
          Use {fix.hex}
        </Btn>
        <Btn onClick={() => onCopy(fix.hex, fix.hex)}>Copy hex</Btn>
        <Btn onClick={() => onCopy(css, 'CSS')}>Copy CSS</Btn>
      </div>
    </article>
  );
}

function Btn({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-[var(--radius)] border px-4 text-[length:var(--t-sm)] font-medium transition-colors duration-[var(--dur-state)] ${
        primary
          ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-text)] hover:opacity-90'
          : 'border-[var(--border-strong)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-sunken)]'
      }`}
    >
      {children}
    </button>
  );
}
