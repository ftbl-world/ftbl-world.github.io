import type { LineupPlayer, MatchHeader, TeamIdentity, TeamLineup } from '../api/match';

/**
 * Which line of the team a position belongs to. The specific prefixes are
 * tested before the general ones, so DM is not read as a defender and CF is not
 * read as the lone striker.
 */
const line = (position: string): number => {
  const p = position.toUpperCase();
  if (p.startsWith('G')) return 0;
  if (p.startsWith('DM')) return 2;
  if (p.startsWith('AM')) return 4;
  if (p.startsWith('CF')) return 5;
  if (/^(LB|RB|LWB|RWB|CD|SW|D)/.test(p)) return 1;
  if (/^(CM|LM|RM|M)/.test(p)) return 3;
  if (/^(F|S|W)/.test(p)) return 6;
  return 3;
};

/** Where across the pitch a position sits, from the left touchline to the right. */
const across = (position: string): number => {
  const p = position.toUpperCase();
  if (/^(LB|LWB)/.test(p)) return -2;
  if (/^(RB|RWB)/.test(p)) return 2;
  if (p.startsWith('L')) return -2;
  if (p.startsWith('R')) return 2;
  if (p.endsWith('-L')) return -1;
  if (p.endsWith('-R')) return 1;
  return 0;
};

/**
 * Splits the ten outfield players into the rows the formation describes.
 *
 * ESPN's `formationPlace` is a positional archetype rather than a layout order
 * — in a 4-2-3-1 it hands 2 to the right back and 9 to the striker — so the
 * formation string supplies the row sizes and the positions supply the order.
 */
const toRows = (lineup: TeamLineup): LineupPlayer[][] => {
  const outfield = lineup.starters.filter((p) => line(p.position) !== 0);
  const sizes = lineup.formation
    .split('-')
    .map((part) => parseInt(part, 10))
    .filter((size) => size > 0);

  const byLine = [...outfield].sort((a, b) => line(a.position) - line(b.position));

  // An unparseable or disagreeing formation would silently drop players, so
  // the positions alone decide the rows in that case.
  const usable =
    sizes.length > 0 && sizes.reduce((total, size) => total + size, 0) === byLine.length;

  const rows: LineupPlayer[][] = [];
  if (usable) {
    let index = 0;
    sizes.forEach((size) => {
      rows.push(byLine.slice(index, index + size));
      index += size;
    });
  } else {
    byLine.forEach((player) => {
      const last = rows[rows.length - 1];
      if (last && line(last[0].position) === line(player.position)) last.push(player);
      else rows.push([player]);
    });
  }

  return rows.map((row) =>
    [...row].sort((a, b) => across(a.position) - across(b.position))
  );
};

function Player({ player }: { player: LineupPlayer }) {
  return (
    <div className="pitch__player">
      <span className="pitch__shirt">
        {player.jersey}
        {player.subbedOut && <span className="pitch__subbed" aria-label="Substituted off" />}
      </span>
      <span className="pitch__name">{player.name}</span>
    </div>
  );
}

function Pitch({ team, lineup }: { team: TeamIdentity; lineup: TeamLineup }) {
  const rows = toRows(lineup);
  const keeper = lineup.starters.find((p) => line(p.position) === 0);

  return (
    <section className="lineup">
      <h3 className="lineup__name">
        <img src={team.crestUrl} width="20" height="20" alt="" />
        {team.name}
        {lineup.formation && <span className="lineup__formation">{lineup.formation}</span>}
      </h3>

      <div className="pitch">
        {/* Rows run forwards-first so the team reads as attacking up the page,
            with the goalkeeper on his own line at the bottom. */}
        {[...rows].reverse().map((row, index) => (
          <div key={index} className="pitch__row">
            {row.map((player) => (
              <Player key={player.id} player={player} />
            ))}
          </div>
        ))}
        {keeper && (
          <div className="pitch__row">
            <Player player={keeper} />
          </div>
        )}
      </div>

      {lineup.bench.length > 0 && (
        <div className="lineup__bench">
          <h4 className="lineup__bench__title">Substitutes</h4>
          <ul>
            {lineup.bench.map((player) => (
              <li key={player.id} className={player.subbedIn ? 'lineup__bench--used' : undefined}>
                <span className="lineup__bench__jersey">{player.jersey}</span>
                {player.name}
                {/* Whether someone actually got on is the only thing worth
                    noting here; ESPN files every unused substitute's position
                    as "SUB", which says nothing. */}
                {player.subbedIn && <span className="lineup__bench__position">On</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Lineups({
  lineups,
  header,
}: {
  lineups: { home: TeamLineup; away: TeamLineup };
  header: MatchHeader;
}) {
  return (
    <div className="lineups">
      <Pitch team={header.home} lineup={lineups.home} />
      <Pitch team={header.away} lineup={lineups.away} />
    </div>
  );
}

export default Lineups;
