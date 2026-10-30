import { useQueries, useQuery } from '@tanstack/react-query';
import { MatchDetails } from '../types';
import { Competition, League, fetchCompetition, fetchMatchDetails } from './espn';

// A fixture under way is worth polling hard; one that finished hours ago is
// not. Tiering these is what stops a forgotten tab pulling megabytes a minute.
const POLL_LIVE = 15_000;
const POLL_UPCOMING = 5 * 60_000;
// Nothing left to play today, but the board still rolls over to tomorrow's
// fixtures, so this keeps a long-lived tab from going permanently stale.
const POLL_SETTLED = 30 * 60_000;

// Kickoff is imminent often enough that waiting out a five-minute tier would
// visibly lag the first whistle.
const KICKOFF_SOON_MS = 10 * 60_000;

const pollInterval = (
  competition: Competition | undefined,
  isHistory: boolean
): number | false => {
  // A day that has already been and gone cannot change.
  if (isHistory) return false;
  if (!competition) return POLL_LIVE;

  const now = Date.now();
  const kickingOffSoon = (match: Competition['matches'][number]) =>
    match.time.phase === 'pre' &&
    new Date(match.time.status).getTime() - now <= KICKOFF_SOON_MS;

  if (competition.matches.some((m) => m.time.phase === 'in' || kickingOffSoon(m))) {
    return POLL_LIVE;
  }
  if (competition.matches.some((m) => m.time.phase === 'pre')) {
    return POLL_UPCOMING;
  }
  return POLL_SETTLED;
};

const cacheKey = (leagueID: string, date: string) => `ftbl-scores-${leagueID}-${date}`;

/**
 * Last known scores, so a reload paints something immediately instead of an
 * empty page. Treated as already stale, so a refetch starts right away.
 */
const readCache = (
  leagueID: string,
  date: string
): { data: Competition; at: number } | undefined => {
  try {
    const raw = localStorage.getItem(cacheKey(leagueID, date));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed?.data?.matches) return undefined;
    return parsed;
  } catch {
    // Corrupt or unreadable cache is not worth reporting; just refetch.
    return undefined;
  }
};

const writeCache = (leagueID: string, date: string, data: Competition) => {
  try {
    localStorage.setItem(
      cacheKey(leagueID, date),
      JSON.stringify({ data, at: Date.now() })
    );
  } catch {
    // Private browsing and full quotas both land here. The app works without it.
  }
};

/**
 * Browsing a fortnight of fixtures would otherwise leave hundreds of dead keys
 * behind, so only the requested dates are kept.
 */
export const pruneCache = (keepDates: string[]) => {
  try {
    const stale = Object.keys(localStorage).filter(
      (key) =>
        key.startsWith('ftbl-scores-') &&
        !keepDates.some((date) => key.endsWith(`-${date}`))
    );
    stale.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nothing here is load-bearing.
  }
};

const competitionQuery = (league: League, date: string, isHistory: boolean) => {
  const cached = readCache(league.leagueID, date);

  return {
    queryKey: ['competition', league.leagueID, date] as const,
    queryFn: async () => {
      const competition = await fetchCompetition(league, date);
      writeCache(league.leagueID, date, competition);
      return competition;
    },
    refetchInterval: ({ state }: { state: { data: Competition | undefined } }) =>
      pollInterval(state.data, isHistory),
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.at,
  };
};

export interface CompetitionResult {
  league: League;
  competition: Competition | undefined;
  isError: boolean;
  isLoading: boolean;
}

/** One query per league, so a single failing competition cannot blank the page. */
export const useCompetitions = (
  leagues: League[],
  date: string,
  isHistory: boolean
): CompetitionResult[] =>
  useQueries({
    queries: leagues.map((league) => competitionQuery(league, date, isHistory)),
    combine: (results) =>
      results.map((result, index) => ({
        league: leagues[index],
        competition: result.data,
        // A failed refetch still has the previous scores to show, so only a
        // failure with nothing cached counts as an error the user must see.
        isError: result.isError && !result.data,
        isLoading: result.isPending,
      })),
  });

export const useMatchDetails = (
  leagueID: string | undefined,
  eventID: string | undefined,
  phase: string | undefined,
  enabled: boolean,
) =>
  useQuery<MatchDetails>({
    queryKey: ['matchDetails', leagueID, eventID],
    queryFn: () => fetchMatchDetails(leagueID!, eventID!),
    enabled: enabled && Boolean(leagueID && eventID),
    // Statistics only move while the match does.
    refetchInterval: phase === 'in' ? POLL_LIVE : false,
  });
