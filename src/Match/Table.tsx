import type { MatchHeader, TableRow } from '../api/match';

function Table({ rows, header }: { rows: TableRow[]; header: MatchHeader }) {
  const playing = new Set([header.home.id, header.away.id]);

  return (
    <table className="leagueTable">
      <thead>
        <tr>
          <th className="leagueTable__rank" scope="col">
            #
          </th>
          <th scope="col">Team</th>
          <th scope="col">P</th>
          <th scope="col">W</th>
          <th scope="col">D</th>
          <th scope="col">L</th>
          <th scope="col">GD</th>
          <th scope="col">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.teamID}
            // The two teams in this match are what the reader came for, so they
            // are picked out of twenty otherwise identical rows.
            className={playing.has(row.teamID) ? 'leagueTable__row--playing' : undefined}
          >
            <td className="leagueTable__rank">{row.rank}</td>
            <td className="leagueTable__team">
              <img src={row.crestUrl} width="18" height="18" alt="" />
              <span>{row.team}</span>
            </td>
            <td>{row.played}</td>
            <td>{row.won}</td>
            <td>{row.drawn}</td>
            <td>{row.lost}</td>
            <td>{row.goalDifference}</td>
            <td className="leagueTable__points">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default Table;
