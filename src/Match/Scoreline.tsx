import type { MatchHeader } from '../api/match';

const kickoffTime = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

const kickoffDay = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

function Scoreline({ header }: { header: MatchHeader }) {
  const { home, away, phase } = header;
  const hasShootout = Boolean(home.shootoutScore && away.shootoutScore);

  return (
    <div className="scoreline">
      <div className="scoreline__meta">
        <span>{header.leagueName}</span>
        {header.venue && <span className="scoreline__venue">{header.venue}</span>}
      </div>

      <div className="scoreline__teams">
        <div className="scoreline__team">
          <img src={home.crestUrl} width="48" height="48" alt="" />
          <span className="scoreline__team__name">{home.name}</span>
        </div>

        <div className="scoreline__result">
          {/* Before kickoff there is no score to show, so the slot carries the
              start time instead of a 0-0 that has not happened yet. */}
          {phase === 'pre' ? (
            <span className="scoreline__kickoff">{kickoffTime(header.kickoff)}</span>
          ) : (
            <span className="scoreline__score">
              {home.score} <span className="scoreline__dash">–</span> {away.score}
            </span>
          )}
          {hasShootout && (
            <span className="scoreline__shootout">
              ({home.shootoutScore} – {away.shootoutScore})
            </span>
          )}
          <span
            className={`scoreline__status${phase === 'in' ? ' scoreline__status--live' : ''}`}
          >
            {phase === 'pre' ? kickoffDay(header.kickoff) : header.status}
          </span>
        </div>

        <div className="scoreline__team">
          <img src={away.crestUrl} width="48" height="48" alt="" />
          <span className="scoreline__team__name">{away.name}</span>
        </div>
      </div>
    </div>
  );
}

export default Scoreline;
