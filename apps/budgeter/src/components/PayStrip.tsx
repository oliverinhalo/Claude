import { gbp, gbpExact } from '../lib/format';

export interface Segment {
  key: string;
  label: string;
  yearly: number;
}

interface Props {
  segments: Segment[];
  gross: number;
}

/** A year of gross pay, ruled into the columns of a payslip. */
export function PayStrip({ segments, gross }: Props) {
  const total = segments.reduce((s, x) => s + x.yearly, 0) || 1;
  return (
    <figure className="strip-fig">
      <div className="strip" aria-hidden="true">
        {segments
          .filter((s) => s.yearly > 0)
          .map((s) => (
            <span
              key={s.key}
              className={`seg seg-${s.key}`}
              style={{ width: `${(s.yearly / total) * 100}%` }}
            />
          ))}
      </div>
      <table className="strip-table tnum">
        <caption className="sr-only">Where {gbp(gross)} of gross pay goes in a year</caption>
        <thead>
          <tr>
            <th scope="col">Where it goes</th>
            <th scope="col" className="num">
              Per month
            </th>
            <th scope="col" className="num">
              Per year
            </th>
          </tr>
        </thead>
        <tbody>
          {segments.map((s) => (
            <tr key={s.key}>
              <th scope="row">
                <span className={`swatch seg-${s.key}`} aria-hidden="true" />
                {s.label}
              </th>
              <td className="num">{gbpExact(s.yearly / 12)}</td>
              <td className="num">{gbp(s.yearly)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
