import { useEffect, useRef } from 'react';
import { MAX_FRET, noteName, type FretPosition } from '../lib/music';

export interface Mark {
  position: FretPosition;
  /** primary: what is sounding · tone: another chord tone · alt: same pitch elsewhere. */
  role: 'primary' | 'tone' | 'alt' | 'root' | 'target';
}

interface Props {
  marks: readonly Mark[];
  /** Offset of the primary note from true pitch, for the tuning ring. */
  cents?: number | null;
  frets?: number;
  /** Open-string pitches, string 6 first, to label the strings. */
  strings: readonly number[];
  label: string;
}

const W = 1000;
const H = 244;
const NUT = 76;
const END = 976;
const TOP = 34;
const GAP = 33;
const INLAYS = [3, 5, 7, 9, 12, 15, 17, 19, 21];

/** Equal-tempered fret spacing: each fret is 2^(−1/12) of the one before. */
function fretX(n: number, frets: number): number {
  const span = 1 - 2 ** (-frets / 12);
  return NUT + ((END - NUT) * (1 - 2 ** (-n / 12))) / span;
}

const stringY = (string: number): number => TOP + (string - 1) * GAP;

function positionXY(p: FretPosition, frets: number): { x: number; y: number } {
  const x = p.fret === 0 ? NUT - 26 : (fretX(p.fret - 1, frets) + fretX(p.fret, frets)) / 2;
  return { x, y: stringY(p.string) };
}

/** A fretboard that lights the string and fret being played. */
export function Fretboard({ marks, cents = null, frets = 15, strings, label }: Props) {
  const n = Math.min(frets, MAX_FRET);
  const top = stringY(1);
  const bottom = stringY(6);
  const ring = cents === null ? 0 : Math.min(1, Math.abs(cents) / 50);
  const inTune = cents !== null && Math.abs(cents) <= 5;

  const box = useRef<HTMLDivElement>(null);
  // On a narrow screen the board scrolls sideways; keep what is sounding in view.
  const focusX = (() => {
    const lit = marks.filter((m) => m.role !== 'alt' && m.position.fret <= n);
    if (lit.length === 0) return null;
    return lit.reduce((sum, m) => sum + positionXY(m.position, n).x, 0) / lit.length;
  })();
  useEffect(() => {
    const el = box.current;
    if (!el || focusX === null || el.scrollWidth <= el.clientWidth) return;
    const left = (focusX / W) * el.scrollWidth - el.clientWidth / 2;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left, behavior: calm ? 'auto' : 'smooth' });
  }, [focusX]);

  return (
    <div
      ref={box}
      role="region"
      aria-label="Fretboard, scrolls sideways on small screens"
      tabIndex={0}
      className="overflow-x-auto rounded-[var(--radius)]"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        className="fretboard block h-auto w-full min-w-[720px]"
      >
        <defs>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x={NUT}
          y={top - 20}
          width={END - NUT}
          height={bottom - top + 40}
          rx="6"
          fill="var(--wood)"
          stroke="var(--wood-edge)"
          strokeWidth="2"
        />
        {INLAYS.filter((f) => f <= n).map((f) => {
          const x = (fretX(f - 1, n) + fretX(f, n)) / 2;
          const mid = (top + bottom) / 2;
          return f === 12 ? (
            <g key={f} fill="var(--inlay)" opacity="0.5">
              <circle cx={x} cy={mid - GAP} r="8" />
              <circle cx={x} cy={mid + GAP} r="8" />
            </g>
          ) : (
            <circle key={f} cx={x} cy={mid} r="8" fill="var(--inlay)" opacity="0.5" />
          );
        })}

        {Array.from({ length: n }, (_, i) => i + 1).map((f) => (
          <line
            key={f}
            x1={fretX(f, n)}
            x2={fretX(f, n)}
            y1={top - 20}
            y2={bottom + 20}
            stroke="var(--fret-wire)"
            strokeWidth="3"
            opacity="0.75"
          />
        ))}
        <rect x={NUT - 6} y={top - 20} width="8" height={bottom - top + 40} fill="var(--nut)" />

        {[1, 2, 3, 4, 5, 6].map((s) => (
          <g key={s}>
            <line
              x1={NUT - 4}
              x2={END}
              y1={stringY(s)}
              y2={stringY(s)}
              stroke="var(--string-line)"
              strokeWidth={0.9 + (s - 1) * 0.42}
              opacity="0.9"
            />
            <text
              x="14"
              y={stringY(s) + 5}
              fontSize="15"
              fill="var(--text-muted)"
              fontFamily="var(--font-mono)"
            >
              {noteName(strings[6 - s] as number)}
            </text>
          </g>
        ))}

        {[3, 5, 7, 9, 12, 15, 17, 19, 21]
          .filter((f) => f <= n)
          .map((f) => (
            <text
              key={f}
              x={(fretX(f - 1, n) + fretX(f, n)) / 2}
              y={bottom + 40}
              fontSize="15"
              textAnchor="middle"
              fill="var(--text-faint)"
              fontFamily="var(--font-mono)"
            >
              {f}
            </text>
          ))}

        {marks
          .filter((m) => m.position.fret <= n)
          .map((m) => {
            const { x, y } = positionXY(m.position, n);
            const key = `${m.position.string}-${m.position.fret}-${m.role}`;
            const name = noteName((strings[6 - m.position.string] as number) + m.position.fret);
            if (m.role === 'primary') {
              return (
                <g key={key} className="mark-primary">
                  <circle
                    cx={x}
                    cy={y}
                    r={16 + ring * 12}
                    fill="none"
                    stroke={inTune ? 'var(--success)' : 'var(--accent)'}
                    strokeWidth="2"
                    opacity="0.8"
                  />
                  <circle cx={x} cy={y} r="14" fill="var(--accent)" filter="url(#glow)" />
                  <text
                    x={x}
                    y={y + 5}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill="var(--accent-text)"
                    fontFamily="var(--font-mono)"
                  >
                    {name.replace('♯', '#')}
                  </text>
                </g>
              );
            }
            const filled = m.role === 'root' || m.role === 'target';
            return (
              <g key={key}>
                <circle
                  cx={x}
                  cy={y}
                  r={m.role === 'alt' ? 8 : 11}
                  fill={filled ? 'var(--accent)' : 'none'}
                  fillOpacity={m.role === 'target' ? 0.9 : 0.85}
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeDasharray={m.role === 'target' ? '4 3' : undefined}
                  opacity={m.role === 'alt' ? 0.55 : 0.9}
                />
                {m.role !== 'alt' && (
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill={filled ? 'var(--accent-text)' : 'var(--string-line)'}
                    fontFamily="var(--font-mono)"
                  >
                    {name.replace('♯', '#')}
                  </text>
                )}
              </g>
            );
          })}
      </svg>
    </div>
  );
}
