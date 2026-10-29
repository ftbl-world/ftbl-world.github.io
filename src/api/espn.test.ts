import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCompetition, fetchMatchDetails } from './espn';

const PREMIER_LEAGUE = { leagueID: 'eng.1', name: 'Premier League' };

const scoreboard = (status: unknown, competitors: unknown[] = []) => ({
  events: [
    {
      id: '740001',
      date: '2026-10-29T19:45Z',
      competitions: [{ status, competitors }],
    },
  ],
});

const respondWith = (body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('match state', () => {
  // Score.tsx keys off an empty state to decide between a kickoff time and a
  // scoreline, so this mapping is the one that must not drift.
  it('is empty for a scheduled match', async () => {
    respondWith(scoreboard({ type: { state: 'pre' } }));

    const league = await fetchCompetition(PREMIER_LEAGUE);

    expect(league.matches[0].time.state).toBe('');
  });

  it('is the clock for a match in progress', async () => {
    respondWith(
      scoreboard({ type: { state: 'in', name: 'STATUS_FIRST_HALF' }, displayClock: "34'" }),
    );

    const league = await fetchCompetition(PREMIER_LEAGUE);

    expect(league.matches[0].time.state).toBe("34'");
  });

  it('is HT at half time rather than a frozen clock', async () => {
    respondWith(
      scoreboard({ type: { state: 'in', name: 'STATUS_HALFTIME' }, displayClock: "45'" }),
    );

    const league = await fetchCompetition(PREMIER_LEAGUE);

    expect(league.matches[0].time.state).toBe('HT');
  });

  it('is FT once the match is complete', async () => {
    respondWith(scoreboard({ type: { state: 'post', completed: true } }));

    const league = await fetchCompetition(PREMIER_LEAGUE);

    expect(league.matches[0].time.state).toBe('FT');
  });

  it('reports postponements instead of claiming full time', async () => {
    respondWith(
      scoreboard({
        type: { state: 'post', completed: false, shortDetail: 'Postponed' },
      }),
    );

    const league = await fetchCompetition(PREMIER_LEAGUE);

    expect(league.matches[0].time.state).toBe('Postponed');
  });
});

describe('phase', () => {
  // The polling tiers read this rather than the display string, so an unknown
  // state must land on 'post' and never keep a league polling forever.
  it.each([
    ['pre', 'pre'],
    ['in', 'in'],
    ['post', 'post'],
    [undefined, 'post'],
    ['something-new', 'post'],
  ])('maps ESPN state %s to %s', async (state, expected) => {
    respondWith(scoreboard({ type: { state } }));

    const league = await fetchCompetition(PREMIER_LEAGUE);

    expect(league.matches[0].time.phase).toBe(expected);
  });
});

describe('competitors', () => {
  it('reads home and away from homeAway rather than array order', async () => {
    respondWith(
      scoreboard({ type: { state: 'post', completed: true } }, [
        { homeAway: 'away', score: '0', team: { displayName: 'Arsenal', logo: 'a.png' } },
        { homeAway: 'home', score: '2', team: { displayName: 'Chelsea', logo: 'c.png' } },
      ]),
    );

    const league = await fetchCompetition(PREMIER_LEAGUE);

    expect(league.matches[0]).toMatchObject({
      homeTeam: 'Chelsea',
      homeScore: '2',
      homeTeamLogoUrl: 'c.png',
      awayTeam: 'Arsenal',
      awayScore: '0',
      awayTeamLogoUrl: 'a.png',
    });
  });

  it('carries shootout scores through as strings', async () => {
    respondWith(
      scoreboard({ type: { state: 'post', completed: true } }, [
        { homeAway: 'home', score: '1', shootoutScore: 4, team: {} },
        { homeAway: 'away', score: '1', shootoutScore: 3, team: {} },
      ]),
    );

    const league = await fetchCompetition(PREMIER_LEAGUE);

    expect(league.matches[0].homePenaltyScore).toBe('4');
    expect(league.matches[0].awayPenaltyScore).toBe('3');
  });

  it('survives a league with no fixtures', async () => {
    respondWith({});

    const league = await fetchCompetition(PREMIER_LEAGUE);

    expect(league.matches).toEqual([]);
  });
});

describe('failures', () => {
  it('rejects rather than returning a half-built competition', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }),
    );

    await expect(fetchCompetition(PREMIER_LEAGUE)).rejects.toThrow('HTTP 403');
  });
});

describe('match details', () => {
  it('derives shots off target and attributes goals to the right side', async () => {
    respondWith({
      boxscore: {
        teams: [
          {
            homeAway: 'home',
            team: { id: '359' },
            statistics: [
              { name: 'possessionPct', displayValue: '61' },
              { name: 'totalShots', displayValue: '14' },
              { name: 'shotsOnTarget', displayValue: '6' },
              { name: 'totalPasses', displayValue: '520' },
            ],
          },
          { homeAway: 'away', team: { id: '363' }, statistics: [] },
        ],
      },
      header: {
        competitions: [
          {
            details: [
              {
                scoringPlay: true,
                team: { id: '359' },
                clock: { displayValue: "23'" },
                participants: [{ athlete: { shortName: 'B. Saka' } }],
              },
              {
                scoringPlay: false,
                team: { id: '359' },
                clock: { displayValue: "40'" },
                participants: [{ athlete: { shortName: 'T. Partey' } }],
              },
              {
                scoringPlay: true,
                team: { id: '363' },
                clock: { displayValue: "77'" },
                penaltyKick: true,
                participants: [{ athlete: { shortName: 'C. Palmer' } }],
              },
            ],
          },
        ],
      },
    });

    const details = await fetchMatchDetails('eng.1', '740001');

    expect(details.home.possession).toBe('61%');
    expect(details.home.shots).toEqual({ onTarget: '6', offTarget: '8' });
    expect(details.home.goals).toEqual([
      { scorer: 'B. Saka', time: '23', isPenalty: false },
    ]);
    expect(details.away.goals).toEqual([
      { scorer: 'C. Palmer', time: '77', isPenalty: true },
    ]);
  });

  it('leaves statistics blank when the match has not started', async () => {
    respondWith({ boxscore: { teams: [] } });

    const details = await fetchMatchDetails('eng.1', '740001');

    expect(details.home.possession).toBe('');
    expect(details.home.shots.offTarget).toBe('');
  });
});
