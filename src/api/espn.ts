import { GoalScorer, MatchDetails, TeamDetails } from '../types';

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

export interface League {
  leagueID: string;
  name: string;
}

export interface Match {
  matchID: string;
  eventID: string;
  leagueID: string;

  time: {
    state: string;
    status: string;
  };

  homeTeam: string;
  awayTeam: string;

  homeScore: string;
  awayScore: string;

  homePenaltyScore: string;
  awayPenaltyScore: string;

  homeTeamLogoUrl: string;
  awayTeamLogoUrl: string;
}

export interface Competition {
  leagueID: string;
  name: string;
  matches: Match[];
}

export const LEAGUES: League[] = [
  { leagueID: 'eng.1', name: 'Premier League' },
  { leagueID: 'esp.1', name: 'La Liga' },
  { leagueID: 'ger.1', name: 'Bundesliga' },
  { leagueID: 'ita.1', name: 'Serie A' },
  { leagueID: 'fra.1', name: 'Ligue 1' },
  { leagueID: 'uefa.champions', name: 'Champions League' },
  { leagueID: 'ned.1', name: 'Eredivisie' },
  { leagueID: 'por.1', name: 'Primeira Liga' },
  { leagueID: 'eng.2', name: 'Championship' },
  { leagueID: 'bra.1', name: 'Brasileirao' },
];

// Score.tsx shows the kickoff time when the state is empty, and the scoreline
// otherwise, so scheduled matches must map to an empty state.
const toState = (status: any): string => {
  const type = status?.type ?? {};
  switch (type.state) {
    case 'pre':
      return '';
    case 'in':
      return type.name === 'STATUS_HALFTIME' ? 'HT' : status.displayClock ?? '';
    default:
      return type.completed ? 'FT' : type.shortDetail ?? '';
  }
};

const toMatch = (leagueID: string, event: any): Match => {
  const competition = event.competitions?.[0] ?? {};
  const competitors: any[] = competition.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === 'home') ?? {};
  const away = competitors.find((c) => c.homeAway === 'away') ?? {};

  return {
    matchID: event.id,
    eventID: event.id,
    leagueID,
    time: {
      state: toState(competition.status ?? event.status),
      status: event.date,
    },
    homeTeam: home.team?.displayName ?? '',
    awayTeam: away.team?.displayName ?? '',
    homeScore: home.score ?? '',
    awayScore: away.score ?? '',
    homePenaltyScore: home.shootoutScore?.toString() ?? '',
    awayPenaltyScore: away.shootoutScore?.toString() ?? '',
    homeTeamLogoUrl: home.team?.logo ?? '',
    awayTeamLogoUrl: away.team?.logo ?? '',
  };
};

const fetchCompetition = async (league: League): Promise<Competition> => {
  const response = await fetch(`${BASE_URL}/${league.leagueID}/scoreboard`);
  if (!response.ok) {
    throw new Error(`Could not load ${league.name} (HTTP ${response.status})`);
  }
  const body = await response.json();
  const events: any[] = body.events ?? [];

  return {
    leagueID: league.leagueID,
    name: league.name,
    matches: events.map((event) => toMatch(league.leagueID, event)),
  };
};

export const fetchCompetitions = (leagues: League[]): Promise<Competition[]> =>
  Promise.all(leagues.map(fetchCompetition));

const statistic = (team: any, name: string): string => {
  const match = (team?.statistics ?? []).find((s: any) => s.name === name);
  return match?.displayValue ?? '';
};

const difference = (total: string, part: string): string => {
  const result = parseInt(total, 10) - parseInt(part, 10);
  return isNaN(result) ? '' : result.toString();
};

const toTeamDetails = (team: any, goals: GoalScorer[]): TeamDetails => {
  const totalShots = statistic(team, 'totalShots');
  const onTarget = statistic(team, 'shotsOnTarget');
  const possession = statistic(team, 'possessionPct');

  return {
    goals,
    possession: possession && `${possession}%`,
    shots: {
      onTarget,
      offTarget: difference(totalShots, onTarget),
    },
    totalPasses: statistic(team, 'totalPasses'),
  };
};

// ESPN credits a goal to the team that benefits from it, so own goals are
// already grouped under the correct side.
const toGoalScorers = (details: any[], teamID: string): GoalScorer[] =>
  details
    .filter((detail) => detail.scoringPlay && detail.team?.id === teamID)
    .map((detail) => ({
      scorer: detail.participants?.[0]?.athlete?.shortName ?? '',
      time: (detail.clock?.displayValue ?? '').replace("'", ''),
      isPenalty: Boolean(detail.penaltyKick),
    }));

export const fetchMatchDetails = async (
  leagueID: string,
  eventID: string
): Promise<MatchDetails> => {
  const response = await fetch(`${BASE_URL}/${leagueID}/summary?event=${eventID}`);
  if (!response.ok) {
    throw new Error(`Could not load match details (HTTP ${response.status})`);
  }
  const body = await response.json();

  const teams: any[] = body.boxscore?.teams ?? [];
  const home = teams.find((t) => t.homeAway === 'home') ?? {};
  const away = teams.find((t) => t.homeAway === 'away') ?? {};
  const details: any[] = body.header?.competitions?.[0]?.details ?? [];

  return {
    home: toTeamDetails(home, toGoalScorers(details, home.team?.id)),
    away: toTeamDetails(away, toGoalScorers(details, away.team?.id)),
  };
};
