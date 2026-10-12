import type { ChangeReport } from '../lib/plan';

const DAY_MIN = 24 * 60;
const MINUTE = 60_000;

/**
 * The signature detail: one day of wall clock, with the hour that does not exist
 * (hatched) or exists twice (doubled) and every scheduled run plotted on it.
 */
export function Strip({ report }: { report: ChangeReport }) {
  const { change, dayWall, dayRuns, affected } = report;
  const pos = (wall: number) => Math.min(DAY_MIN, Math.max(0, (wall - dayWall) / MINUTE));
  const from = pos(change.from);
  const to = pos(change.to);
  const hit = new Set(affected.map((a) => a.wall));
  const shown = dayRuns.length > 96 ? dayRuns.filter((w) => hit.has(w)) : dayRuns;

  return (
    <div className="strip" aria-hidden="true">
      <div className="strip-track">
        <div
          className="strip-zone"
          data-kind={change.kind}
          style={{
            left: `${(from / DAY_MIN) * 100}%`,
            width: `${((to - from) / DAY_MIN) * 100}%`,
          }}
        />
        {shown.map((w) => (
          <div
            key={w}
            className="strip-mark"
            data-hit={hit.has(w) ? 'true' : 'false'}
            style={{ left: `${(pos(w) / DAY_MIN) * 100}%` }}
          />
        ))}
      </div>
      <div className="strip-hours">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} style={{ left: `${(h / 24) * 100}%` }}>
            {String(h).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  );
}
