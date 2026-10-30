import type { MatchHeader, StatRow } from '../api/match';

function Stats({ rows, header }: { rows: StatRow[]; header: MatchHeader }) {
  return (
    <div className="stats">
      <div className="stats__legend">
        <span className="stats__legend__home">
          {header.home.abbreviation || header.home.name}
        </span>
        <span className="stats__legend__away">
          {header.away.abbreviation || header.away.name}
        </span>
      </div>

      {rows.map((row) => (
        <div key={row.label} className="stats__row">
          <div className="stats__values">
            <span className="stats__value">{row.home}</span>
            <span className="stats__label">{row.label}</span>
            <span className="stats__value">{row.away}</span>
          </div>
          {/* The bar is filled by both teams, so one side holding all of a
              measure still reads as that side rather than as an empty track.
              Nothing recorded yet gets a flat track instead of a false split. */}
          <div className={`stats__bar${row.recorded ? '' : ' stats__bar--empty'}`}>
            {row.recorded && (
              <div
                className="stats__bar__home"
                style={{ width: `${row.homeShare * 100}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Stats;
