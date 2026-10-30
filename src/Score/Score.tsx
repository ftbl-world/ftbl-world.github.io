import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import Header from "../Header/Header";
import { Competition, LEAGUES, Match, toDateParam } from "../api/espn";
import {
  addDays,
  describeDay,
  isBeforeToday,
  isSameDay,
  startOfDay,
  timeZoneLabel,
} from "../api/dates";
import { pruneCache, useCompetitions } from "../api/queries";
import DateStrip from "./DateStrip";
import LeagueStrip, { ALL_LEAGUES } from "./LeagueStrip";
import "./Score.scss";

function Live() {
  // Read on first render rather than in an effect. Setting it afterwards made
  // the page fetch every league once, then immediately refetch the stored one.
  const [activeLeague, setActiveLeague] = useState(
    () => localStorage.getItem('ftbl-selected-league') || ALL_LEAGUES
  );
  // Deliberately not persisted: landing on a stale date would be confusing.
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [liveOnly, setLiveOnly] = useState(false);
  const history = useHistory();

  // Recomputed per render so a tab left open overnight still agrees with the
  // calendar about which day is "Today".
  const today = startOfDay(new Date());

  const handleActiveLeagueChange = (leagueID: string) => {
    setActiveLeague(leagueID);
    localStorage.setItem('ftbl-selected-league', leagueID);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(startOfDay(date));
    // A past or future day has nothing in progress, so the filter would only
    // produce an empty board.
    if (!isSameDay(date, today)) setLiveOnly(false);
  };

  const handleLiveOnlyChange = (next: boolean) => {
    setLiveOnly(next);
    // Matches are only ever in progress today.
    if (next) setSelectedDate(today);
  };

  const convertTime = (timeString: string) => {
    const date = new Date(timeString);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    return `${hours}:${minutes}`;
  }

  // Kickoffs are grouped and labelled in local time, matching convertTime. A
  // round can straddle midnight UTC while still being one evening locally.
  const groupByDate = (matches: Match[]) => {
    const groups: { day: number; label: string; matches: Match[] }[] = [];

    matches.forEach((match) => {
      const day = startOfDay(new Date(match.time.status)).getTime();
      const group = groups.find((candidate) => candidate.day === day);
      if (group) {
        group.matches.push(match);
      } else {
        groups.push({
          day,
          label: describeDay(new Date(match.time.status), today),
          matches: [match],
        });
      }
    });

    return groups;
  };

  const openMatch = (match: Match) => {
    history.push(`/match/${match.leagueID}/${match.eventID}`);
  };

  // Only the leagues currently on screen are polled, so viewing a single
  // league costs one request per refresh instead of one per competition.
  const visibleLeagues = activeLeague === ALL_LEAGUES
    ? LEAGUES
    : LEAGUES.filter((league) => league.leagueID === activeLeague);

  const dateKey = toDateParam(selectedDate);
  const results = useCompetitions(visibleLeagues, dateKey, isBeforeToday(selectedDate, today));

  // Browsing around the strip would otherwise leave a cache entry per league
  // per visited day.
  useEffect(() => {
    const window = Array.from({ length: 7 }, (_, index) => addDays(today, index - 3));
    pruneCache([...window, selectedDate].map(toDateParam));
    // today is a fresh object each render; its date is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  // The Live filter reads the data already on screen, so it costs no extra
  // requests; `all/scoreboard` would be one request but 850 KB a poll.
  const liveCount = useMemo(
    () =>
      results.reduce(
        (total, result) =>
          total +
          (result.competition?.matches.filter((m) => m.time.phase === 'in').length ?? 0),
        0
      ),
    [results]
  );

  const matchesFor = (competition: Competition | undefined) => {
    const matches = competition?.matches ?? [];
    return liveOnly ? matches.filter((match) => match.time.phase === 'in') : matches;
  };

  // A whole-page error is now reserved for losing every league at once. One
  // competition failing degrades its own section and leaves the rest readable.
  const isError = results.length > 0 && results.every((result) => result.isError);

  // Across every league, only the ones with fixtures are worth a section, but a
  // failed or explicitly selected league still needs somewhere to say so.
  const sections = results.filter((result) =>
    (activeLeague !== ALL_LEAGUES && !liveOnly) ||
    result.isError ||
    matchesFor(result.competition).length > 0
  );

  const fixtureCounts = Object.fromEntries(
    results.map((result) => [result.league.leagueID, result.competition?.matches.length ?? 0])
  );

  return (
    <div className="liveContainer">
      <Header liveCount={liveCount} />
      <div className="liveContainer__body">
        <div className="liveContainer__body__scores">
          {isError === true && <div className="errorPage"><span>Cannot fetch the data right now.</span></div>}
          {isError === false &&
            <div className="liveContainer__controls">
              <DateStrip
                selected={selectedDate}
                today={today}
                onSelect={handleDateSelect}
                liveOnly={liveOnly}
                onLiveOnlyChange={handleLiveOnlyChange}
                liveCount={liveCount}
              />
              <LeagueStrip
                leagues={LEAGUES}
                active={activeLeague}
                onSelect={handleActiveLeagueChange}
                counts={fixtureCounts}
              />
              <span className="liveContainer__timezone">
                Kickoff times in {timeZoneLabel()}
              </span>
            </div>
          }
          {isError === false && sections.length === 0 &&
            <div className="emptyBoard">
              <span>
                {liveOnly
                  ? 'No matches in progress right now.'
                  : `No matches on ${describeDay(selectedDate, today).toLowerCase()}.`}
              </span>
            </div>
          }
          {isError === false && sections.map(({ league, competition, isError: sectionFailed }) => {
            return (
              <div id={league.leagueID} key={league.leagueID} className="liveContainer__body__leagueContainer">
                <div className="leagueNameContainer"><span className="leagueName">{league.name}</span></div>
                <table>
                  <tbody>
                    {sectionFailed && <tr><td><div className="noGames"><span><b>Scores unavailable right now.</b></span></div></td></tr>}
                    {groupByDate(matchesFor(competition)).map((group) => {
                      return (
                        <React.Fragment key={group.day}>
                        {/* The strip already names the selected day, so a header
                            is only worth showing when ESPN's UTC-based date
                            returns a fixture that falls on a different one. */}
                        {!isSameDay(new Date(group.day), selectedDate) &&
                          <tr className="matchDate">
                            <td colSpan={3}><span>{group.label}</span></td>
                          </tr>
                        }
                        {group.matches.map((match: any) => {
                      return (
                        <tr key={match.matchID} onClick={() => openMatch(match)}>
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
                    {!sectionFailed && matchesFor(competition).length === 0 && <tr><td><div className="noGames"><span><b>{liveOnly ? 'Nothing in progress.' : 'No matches scheduled.'}</b></span></div></td></tr>}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Live;
