const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

export interface League {
  leagueID: string;
  name: string;
}

/** ESPN's lifecycle for a fixture: not started, under way, finished. */
export type Phase = 'pre' | 'in' | 'post';

export interface Match {
  matchID: string;
  eventID: string;
  leagueID: string;

  time: {
    state: string;
    status: string;
    // `state` is a display string, so anything deciding how hard to poll reads
    // this instead.
    phase: Phase;
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
  { leagueID: 'uefa.europa', name: 'Europa League' },
  { leagueID: 'uefa.europa.conf', name: 'Conference League' },
  { leagueID: 'eng.league_cup', name: 'Carabao Cup' },
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

const toPhase = (status: any): Phase => {
  const state = status?.type?.state;
  return state === 'pre' || state === 'in' ? state : 'post';
};

const toMatch = (leagueID: string, event: any): Match => {
  const competition = event.competitions?.[0] ?? {};
  const competitors: any[] = competition.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === 'home') ?? {};
  const away = competitors.find((c) => c.homeAway === 'away') ?? {};
  const status = competition.status ?? event.status;

  return {
    matchID: event.id,
    eventID: event.id,
    leagueID,
    time: {
      state: toState(status),
      status: event.date,
      phase: toPhase(status),
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

/** ESPN expects a bare YYYYMMDD, which is also how queries are keyed. */
export const toDateParam = (date: Date): string =>
  [
    date.getFullYear(),
    `${date.getMonth() + 1}`.padStart(2, '0'),
    `${date.getDate()}`.padStart(2, '0'),
  ].join('');

export const fetchCompetition = async (
  league: League,
  date?: string
): Promise<Competition> => {
  const query = date ? `?dates=${date}` : '';
  const response = await fetch(`${BASE_URL}/${league.leagueID}/scoreboard${query}`);
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
