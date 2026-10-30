import type { MatchHeader } from '../api/match';

const kickoffTime = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

// The year matters here in a way it does not on the board: a match page is
// reachable from a link or an old season, with nothing around it to say when
// it was played.
const kickoffDate = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

function Scoreline({ header }: { header: MatchHeader }) {
  const { home, away, phase } = header;
  const hasShootout = Boolean(home.shootoutScore && away.shootoutScore);
  const date = kickoffDate(header.kickoff);
  const time = kickoffTime(header.kickoff);

  return (
    <div className="scoreline">
      <div className="scoreline__meta">
        <span>{header.leagueName}</span>
        {header.venue && <span className="scoreline__venue">{header.venue}</span>}
      </div>

      {date && (
        <time className="scoreline__date" dateTime={header.kickoff}>
          {/* A match yet to start already shows its kickoff time below, so
              repeating it here would say the same thing twice. */}
          {phase === 'pre' ? date : [date, time].filter(Boolean).join(' · ')}
        </time>
      )}

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
          {phase !== 'pre' && (
            <span
              className={`scoreline__status${phase === 'in' ? ' scoreline__status--live' : ''}`}
            >
              {header.status}
            </span>
          )}
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
