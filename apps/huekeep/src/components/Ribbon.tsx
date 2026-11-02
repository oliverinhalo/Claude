import { useMemo } from 'react';
import { rgbToOklch, type RGB } from '../lib/color';
import { ribbon, type Target } from '../lib/fix';

interface Props {
  moving: RGB;
  fixed: RGB;
  fixedTo: RGB;
  target: Target;
  what: string;
}

/**
 * The signature: the moving colour at every lightness, same hue and chroma, with the
 * lightness ranges that clear the target marked underneath, and where it started and ended.
 */
export function Ribbon({ moving, fixed, fixedTo, target, what }: Props) {
  const samples = useMemo(() => ribbon(moving, fixed, target), [moving, fixed, target]);
  const gradient = `linear-gradient(to right, ${samples.map((s) => s.hex).join(', ')})`;
  const was = rgbToOklch(moving).l * 100;
  const now = rgbToOklch(fixedTo).l * 100;

  const zones: { from: number; to: number }[] = [];
  samples.forEach((s, i) => {
    if (!s.pass) return;
    const last = zones[zones.length - 1];
    const pos = (i / (samples.length - 1)) * 100;
    if (last && Math.abs(last.to - pos) < 100 / (samples.length - 1) + 0.01) last.to = pos;
    else zones.push({ from: pos, to: pos });
  });

  return (
    <figure className="mt-4">
      <div className="relative pt-5 pb-5" aria-hidden="true">
        <div
          className="h-7 border border-[var(--border-strong)]"
          style={{ background: gradient }}
        />
        <div className="relative mt-1 h-1.5 bg-[var(--surface-sunken)]">
          {zones.map((z) => (
            <span
              key={z.from}
              className="absolute inset-y-0 bg-[var(--success)]"
              style={{ left: `${z.from}%`, width: `${Math.max(z.to - z.from, 0.8)}%` }}
            />
          ))}
        </div>
        <Marker at={was} label="was" />
        <Marker at={now} label="now" strong />
      </div>
      <figcaption className="text-[length:var(--t-xs)] text-[var(--text-faint)]">
        {what} at every lightness, hue held. Green marks where it reaches {target} : 1.
      </figcaption>
    </figure>
  );
}

function Marker({ at, label, strong }: { at: number; label: string; strong?: boolean }) {
  return (
    <span
      className="absolute top-0 -translate-x-1/2 transition-[left] duration-[var(--dur-move)] ease-[var(--ease-enter)]"
      style={{ left: `${Math.min(97, Math.max(3, at))}%` }}
    >
      <span
        className={`block text-center text-[length:var(--t-xs)] leading-none ${strong ? 'font-semibold text-[var(--accent)]' : 'text-[var(--text-faint)]'}`}
      >
        {label}
      </span>
      <span
        className={`mx-auto mt-0.5 block h-9 w-0.5 ${strong ? 'bg-[var(--accent)]' : 'bg-[var(--text-faint)]'}`}
      />
    </span>
  );
}
