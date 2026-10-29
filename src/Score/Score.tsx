import React, { useState } from "react";
import MatchDetail from "../MatchDetail/MatchDetail";
import { LEAGUES, Match } from "../api/espn";
import { useCompetitions } from "../api/queries";
import "./Score.scss";

function Live() {
  // Read on first render rather than in an effect. Setting it afterwards made
  // the page fetch every league once, then immediately refetch the stored one.
  const [activeLeague, setActiveLeague] = useState(
    () => localStorage.getItem('ftbl-selected-league') || 'AllLeagues'
  );
  const [dialogOpen, setDialogOpen] = useState(false);	
  const [dialogState, setDialogState] = useState({});

  const handleActiveLeagueChange = (e: any) => {
    setActiveLeague(e.target.value);
    localStorage.setItem('ftbl-selected-league', e.target.value);
  };

  const convertTime = (timeString: string) => {
    const date = new Date(timeString);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    return `${hours}:${minutes}`;
  }

  // Kickoffs are grouped and labelled in local time, matching convertTime. A
  // round can straddle midnight UTC while still being one evening locally.
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const describeDate = (timeString: string) => {
    const date = new Date(timeString);
    const today = startOfDay(new Date());
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    switch (startOfDay(date).getTime()) {
      case today.getTime():
        return 'Today';
      case tomorrow.getTime():
        return 'Tomorrow';
      default:
        return date.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
    }
  };

  const groupByDate = (matches: Match[]) => {
    const groups: { day: number; label: string; matches: Match[] }[] = [];

    matches.forEach((match) => {
      const day = startOfDay(new Date(match.time.status)).getTime();
      const group = groups.find((candidate) => candidate.day === day);
      if (group) {
        group.matches.push(match);
      } else {
        groups.push({ day, label: describeDate(match.time.status), matches: [match] });
      }
    });

    return groups;
  };

  const handleTableRowClick = (match: any) => {	
    setDialogOpen(true);	
    setDialogState(match)	
  };	
  const handleMatchDetailDialogClose = () => {	
    setDialogOpen(false);	
  };

  // Only the leagues currently on screen are polled, so viewing a single
  // league costs one request per refresh instead of one per competition.
  const visibleLeagues = activeLeague === 'AllLeagues'
    ? LEAGUES
    : LEAGUES.filter((league) => league.leagueID === activeLeague);

  const results = useCompetitions(visibleLeagues);

  // A whole-page error is now reserved for losing every league at once. One
  // competition failing degrades its own section and leaves the rest readable.
  const isError = results.length > 0 && results.every((result) => result.isError);

  // Across every league, only the ones with fixtures are worth a section, but a
  // failed or explicitly selected league still needs somewhere to say so.
  const sections = results.filter((result) =>
    activeLeague !== 'AllLeagues' ||
    result.isError ||
    (result.competition?.matches.length ?? 0) > 0
  );

  return (
    <div className="liveContainer">
      <div className="liveContainer__header">
        <div className="liveContainer__header__content">
          <span className="live__dot"></span>
          <span className="live__title">Live Scores</span>
        </div>
      </div>
      <div className="liveContainer__body">
        <div className="liveContainer__body__scores">
          {isError === true && <div className="errorPage"><span>Cannot fetch the data right now.</span></div>}
          {isError === false &&
            <div className="league__selector">
              <label className="sr-only" htmlFor="leagueSelect">Competition</label>
              <select id="leagueSelect" value={activeLeague} onChange={(e: any) => handleActiveLeagueChange(e)}>
                <option value="AllLeagues">All Leagues</option>
                {LEAGUES.map((league) => {
                  return (
                    <option key={league.leagueID} value={league.leagueID}>{league.name}</option>
                  )
                })}
              </select>
            </div>
          }
          {isError === false && sections.map(({ league, competition, isError: sectionFailed }) => {
            return (
              <div id={league.leagueID} key={league.leagueID} className="liveContainer__body__leagueContainer">
                <div className="leagueNameContainer"><span className="leagueName">{league.name}</span></div>
                <table>
                  <tbody>
                    {sectionFailed && <tr><td><div className="noGames"><span><b>Scores unavailable right now.</b></span></div></td></tr>}
                    {groupByDate(competition?.matches ?? []).map((group) => {
                      return (
                        <React.Fragment key={group.day}>
                        <tr className="matchDate">
                          <td colSpan={3}><span>{group.label}</span></td>
                        </tr>
                        {group.matches.map((match: any) => {
                      return (
                        <tr key={match.matchID} onClick={() => handleTableRowClick(match)}>
                          <td className="liveScore__homeTeam">
                            <div className="home__name__logo">
                              <span className="homeTeam">{match.homeTeam}</span>
                              <img src={match.homeTeamLogoUrl} width="20" height="20" alt=""></img>
                            </div>
                          </td>
                          <td className="liveScore">
                            <div className="liveScoreContainer">
                              {match.time.state !== "" && <span className="state"><b>{match.time.state}</b></span>}
                                {
                                  match.time.state === "" ?
                                    <span className="score"><b>{convertTime(match.time.status)}</b></span>
                                    :
                                    <span className="score"><b>{match.homeScore} - {match.awayScore}</b></span>
                                }
                              { match.homePenaltyScore && match.awayPenaltyScore && <span className="score">({match.homePenaltyScore} - {match.awayPenaltyScore})</span> }
                            </div>
                          </td>
                          <td className="liveScore__awayTeam">
                            <div className="away__name__logo">
                              <img src={match.awayTeamLogoUrl} width="20" height="20" alt=""></img>
                              <span className="awayTeam">{match.awayTeam}</span>
                            </div>
                          </td>
                        </tr>
                      );
                        })}
                        </React.Fragment>
                      );
                    })}
                    {!sectionFailed && competition?.matches.length === 0 && <tr><td><div className="noGames"><span><b>No matches scheduled.</b></span></div></td></tr>}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
      {isError === false && 	
        <div>	
          <MatchDetail dialogOpen={dialogOpen} dialogState={dialogState} handleMatchDetailDialogClose={handleMatchDetailDialogClose}/>	
        </div>	
      }
    </div>
  );
}

export default Live;
