import { Phase } from './espn';

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// The ESPN summary payload is deeply nested and undocumented. This module is
// the boundary where it becomes typed, so the escape hatch lives in one alias
// rather than being sprinkled through every parser below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

// The competitors block carries a team id but no crest, while every other
// section carries a crest URL built from that id. This rebuilds it.
const crest = (teamID: string) =>
  `https://a.espncdn.com/i/teamlogos/soccer/500/${teamID}.png`;

export type Side = 'home' | 'away';

export interface TeamIdentity {
  id: string;
  name: string;
  abbreviation: string;
  crestUrl: string;
  score: string;
  shootoutScore: string;
}

/** The scoreline and context shown above the tabs. */
export interface MatchHeader {
  leagueName: string;
  venue: string;
  kickoff: string;
  status: string;
  phase: Phase;
  home: TeamIdentity;
  away: TeamIdentity;
}

export type EventKind =
  | 'goal'
  | 'own-goal'
  | 'penalty'
  | 'yellow'
  | 'red'
  | 'substitution'
  | 'period'
  | 'other';

export interface TimelineEvent {
  id: string;
  kind: EventKind;
  clock: string;
  text: string;
  /** Absent for whistles and anything else belonging to neither team. */
  side: Side | undefined;
  /** Scorer then assist, or the player coming on then the one going off. */
  participants: string[];
}

export interface LineupPlayer {
  id: string;
  name: string;
  jersey: string;
  position: string;
  subbedIn: boolean;
  subbedOut: boolean;
  /** 1-based slot in the formation, counting up from the goalkeeper. */
  formationPlace: number;
}

export interface TeamLineup {
  formation: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface StatRow {
  label: string;
  home: string;
  away: string;
  /** Home share of the pair, 0 to 1, for the comparison bar. */
  homeShare: number;
  /** False when both teams are on zero, which is not the same as an even split. */
  recorded: boolean;
}

export interface TableRow {
  rank: string;
  teamID: string;
  team: string;
  crestUrl: string;
  played: string;
  won: string;
  drawn: string;
  lost: string;
  goalDifference: string;
  points: string;
}

export interface FormResult {
  id: string;
  /** W, D or L as ESPN reports it. */
  result: string;
  opponent: string;
  score: string;
  competition: string;
  date: string;
  /** "vs" for a home fixture, "@" for an away one. */
  atVs: string;
}

export interface CommentaryEntry {
  sequence: number;
  clock: string;
  text: string;
}

export interface MatchSummary {
  header: MatchHeader;
  timeline: TimelineEvent[];
  lineups: { home: TeamLineup; away: TeamLineup } | undefined;
  stats: StatRow[];
  table: TableRow[];
  form: { home: FormResult[]; away: FormResult[] } | undefined;
  commentary: CommentaryEntry[];
}

const toPhase = (state: unknown): Phase =>
  state === 'pre' || state === 'in' ? state : 'post';

const toIdentity = (competitor: Raw): TeamIdentity => {
  const team = competitor?.team ?? {};
  return {
    id: team.id ?? '',
    name: team.displayName ?? '',
    abbreviation: team.abbreviation ?? '',
    crestUrl: team.id ? crest(team.id) : '',
    score: competitor?.score ?? '',
    shootoutScore: competitor?.shootoutScore?.toString() ?? '',
  };
};

const toHeader = (body: Raw): MatchHeader => {
  const competition = body.header?.competitions?.[0] ?? {};
  const competitors: Raw[] = competition.competitors ?? [];
  const status = competition.status ?? {};
  const venue = body.gameInfo?.venue ?? {};

  return {
    leagueName: body.header?.league?.name ?? '',
    venue: [venue.fullName, venue.address?.city].filter(Boolean).join(', '),
    kickoff: competition.date ?? '',
    status: status.type?.detail ?? '',
    phase: toPhase(status.type?.state),
    home: toIdentity(competitors.find((c) => c.homeAway === 'home')),
    away: toIdentity(competitors.find((c) => c.homeAway === 'away')),
  };
};

// ESPN splits goals across several type strings — goal, goal---header,
// penalty---scored — so `scoringPlay` is the reliable signal, and the text
// separates an own goal from a normal one.
const toKind = (type: string, text: string, scoringPlay: boolean): EventKind => {
  const lower = text.toLowerCase();
  if (scoringPlay) {
    if (lower.includes('own goal')) return 'own-goal';
    if (type.startsWith('penalty') || lower.includes('penalty')) return 'penalty';
    return 'goal';
  }
  if (type.includes('yellow')) return 'yellow';
  if (type.includes('red')) return 'red';
  if (type === 'substitution') return 'substitution';
  if (['kickoff', 'halftime', 'start-2nd-half', 'end-regular-time'].includes(type)) {
    return 'period';
  }
  return 'other';
};

// Stoppages are in keyEvents but are not key events: a match with two injuries
// collects four rows saying only that play paused and resumed.
const NOISE = ['start-delay', 'end-delay'];

const toTimeline = (body: Raw, header: MatchHeader): TimelineEvent[] => {
  const events: Raw[] = body.keyEvents ?? [];

  return events
    .filter((event) => !NOISE.includes(event.type?.type))
    .map((event) => {
      const teamID = event.team?.id;
      return {
        id: event.id,
        kind: toKind(event.type?.type ?? '', event.text ?? '', Boolean(event.scoringPlay)),
        clock: event.clock?.displayValue ?? '',
        // Whistles arrive with an empty text and only a type, which would
        // otherwise render as a blank row with a clock beside it.
        text: event.text || event.type?.text || '',
        side:
          teamID === header.home.id
            ? ('home' as const)
            : teamID === header.away.id
              ? ('away' as const)
              : undefined,
        participants: (event.participants ?? [])
          .map((p: Raw) => p.athlete?.displayName)
          .filter(Boolean),
      };
    })
    .filter((event) => event.text || event.participants.length > 0);
};

const toPlayer = (entry: Raw): LineupPlayer => ({
  id: entry.athlete?.id ?? '',
  name: entry.athlete?.shortName ?? entry.athlete?.displayName ?? '',
  jersey: entry.jersey ?? '',
  position: entry.position?.abbreviation ?? '',
  subbedIn: Boolean(entry.subbedIn),
  subbedOut: Boolean(entry.subbedOut),
  formationPlace: Number(entry.formationPlace ?? 0),
});

const toLineup = (roster: Raw): TeamLineup => {
  const players: Raw[] = roster?.roster ?? [];
  return {
    formation: roster?.formation ?? '',
    starters: players
      .filter((p) => p.starter)
      .map(toPlayer)
      .sort((a, b) => a.formationPlace - b.formationPlace),
    bench: players.filter((p) => !p.starter).map(toPlayer),
  };
};

const toLineups = (body: Raw): MatchSummary['lineups'] => {
  const rosters: Raw[] = body.rosters ?? [];
  const home = rosters.find((r) => r.homeAway === 'home');
  const away = rosters.find((r) => r.homeAway === 'away');
  // Lineups only appear about an hour before kickoff.
  if (!home?.roster?.length || !away?.roster?.length) return undefined;
  return { home: toLineup(home), away: toLineup(away) };
};

// A curated order, because the payload's 28 measures arrive grouped by how
// ESPN collects them rather than by what anyone wants to read first.
const STATS: Array<{ name: string; label: string }> = [
  { name: 'possessionPct', label: 'Possession' },
  { name: 'totalShots', label: 'Shots' },
  { name: 'shotsOnTarget', label: 'Shots on target' },
  { name: 'wonCorners', label: 'Corners' },
  { name: 'saves', label: 'Saves' },
  { name: 'foulsCommitted', label: 'Fouls' },
  { name: 'offsides', label: 'Offsides' },
  { name: 'yellowCards', label: 'Yellow cards' },
  { name: 'redCards', label: 'Red cards' },
  { name: 'totalPasses', label: 'Passes' },
  { name: 'passPct', label: 'Pass accuracy' },
  { name: 'totalTackles', label: 'Tackles' },
  { name: 'interceptions', label: 'Interceptions' },
  { name: 'totalClearance', label: 'Clearances' },
];

// possessionPct already reads 0-100, while every other percentage arrives as a
// fraction. Formatting them the same way would report 70% passing as 1%.
const format = (name: string, value: string): string => {
  if (name === 'possessionPct') return `${value}%`;
  if (name.toLowerCase().endsWith('pct')) {
    return `${Math.round(parseFloat(value) * 100)}%`;
  }
  return value;
};

const toStats = (body: Raw): StatRow[] => {
  const teams: Raw[] = body.boxscore?.teams ?? [];
  const home = teams.find((t) => t.homeAway === 'home');
  const away = teams.find((t) => t.homeAway === 'away');

  const read = (team: Raw, name: string): Raw =>
    (team?.statistics ?? []).find((s: Raw) => s.name === name);

  return STATS.flatMap(({ name, label }) => {
    const h = read(home, name);
    const a = read(away, name);
    if (!h || !a) return [];

    const hValue = parseFloat(h.displayValue) || 0;
    const aValue = parseFloat(a.displayValue) || 0;
    const total = hValue + aValue;

    return [
      {
        label,
        home: format(name, h.displayValue),
        away: format(name, a.displayValue),
        homeShare: total === 0 ? 0.5 : hValue / total,
        recorded: total > 0,
      },
    ];
  });
};

const toTable = (body: Raw): TableRow[] => {
  const entries: Raw[] = body.standings?.groups?.[0]?.standings?.entries ?? [];

  return entries.map((entry) => {
    const stat = (name: string): string =>
      (entry.stats ?? []).find((s: Raw) => s.name === name)?.displayValue ?? '';

    return {
      rank: stat('rank'),
      teamID: entry.id ?? '',
      team: entry.team ?? '',
      crestUrl: entry.logo?.[0]?.href ?? (entry.id ? crest(entry.id) : ''),
      played: stat('gamesPlayed'),
      won: stat('wins'),
      drawn: stat('ties'),
      lost: stat('losses'),
      goalDifference: stat('pointDifferential'),
      points: stat('points'),
    };
  });
};

const toForm = (body: Raw, header: MatchHeader): MatchSummary['form'] => {
  const blocks: Raw[] = body.lastFiveGames ?? [];
  if (!blocks.length) return undefined;

  const results = (teamID: string): FormResult[] => {
    const block = blocks.find((b) => b.team?.id === teamID);
    return (block?.events ?? []).map((event: Raw) => {
      // ESPN's `score` field reads winner first, so a 0-2 home defeat arrives
      // as "2-0". A form list only makes sense from one team's point of view.
      const atHome = event.homeTeamId === teamID;
      const own = atHome ? event.homeTeamScore : event.awayTeamScore;
      const other = atHome ? event.awayTeamScore : event.homeTeamScore;

      return {
        id: event.id,
        result: event.gameResult ?? '',
        opponent: event.opponent?.displayName ?? '',
        score: own !== undefined && other !== undefined ? `${own}-${other}` : (event.score ?? ''),
        competition: event.leagueAbbreviation ?? event.leagueName ?? '',
        date: event.gameDate ?? '',
        atVs: event.atVs ?? '',
      };
    });
  };

  return { home: results(header.home.id), away: results(header.away.id) };
};

const toCommentary = (body: Raw): CommentaryEntry[] =>
  (body.commentary ?? []).map((entry: Raw) => ({
    sequence: entry.sequence ?? 0,
    clock: entry.time?.displayValue ?? '',
    text: entry.text ?? '',
  }));

export const fetchMatchSummary = async (
  leagueID: string,
  eventID: string
): Promise<MatchSummary> => {
  const response = await fetch(`${BASE_URL}/${leagueID}/summary?event=${eventID}`);
  if (!response.ok) {
    throw new Error(`Could not load match (HTTP ${response.status})`);
  }
  const body = await response.json();
  const header = toHeader(body);

  return {
    header,
    timeline: toTimeline(body, header),
    lineups: toLineups(body),
    stats: toStats(body),
    table: toTable(body),
    form: toForm(body, header),
    commentary: toCommentary(body),
  };
};
