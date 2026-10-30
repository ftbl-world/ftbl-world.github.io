import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMatchSummary } from './match';

const respondWith = (body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body })
  );

const header = {
  league: { name: 'English Premier League' },
  competitions: [
    {
      date: '2026-10-25T14:00Z',
      status: { type: { state: 'post', detail: 'FT' } },
      competitors: [
        { homeAway: 'home', score: '0', team: { id: '384', displayName: 'Crystal Palace', abbreviation: 'CRY' } },
        { homeAway: 'away', score: '2', team: { id: '361', displayName: 'Newcastle United', abbreviation: 'NEW' } },
      ],
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('match header', () => {
  it('rebuilds a crest URL, which the competitors block omits', async () => {
    respondWith({ header });

    const summary = await fetchMatchSummary('eng.1', '1');

    expect(summary.header.home.crestUrl).toBe(
      'https://a.espncdn.com/i/teamlogos/soccer/500/384.png'
    );
  });
});

describe('timeline', () => {
  const event = (over: Record<string, unknown>) => ({
    id: '1',
    clock: { displayValue: "47'" },
    team: { id: '361' },
    participants: [{ athlete: { displayName: 'W. Osula' } }],
    ...over,
  });

  // ESPN splits goals across goal, goal---header and penalty---scored, so the
  // kind is taken from scoringPlay rather than the type string.
  it('reads a header as a goal despite its own type string', async () => {
    respondWith({
      header,
      keyEvents: [event({ type: { type: 'goal---header' }, text: 'Goal!', scoringPlay: true })],
    });

    const summary = await fetchMatchSummary('eng.1', '1');

    expect(summary.timeline[0].kind).toBe('goal');
    expect(summary.timeline[0].side).toBe('away');
  });

  it('separates an own goal from a penalty', async () => {
    respondWith({
      header,
      keyEvents: [
        event({ id: 'a', type: { type: 'goal' }, text: 'Own Goal by J. Doe.', scoringPlay: true }),
        event({ id: 'b', type: { type: 'penalty---scored' }, text: 'Goal!', scoringPlay: true }),
      ],
    });

    const summary = await fetchMatchSummary('eng.1', '1');

    expect(summary.timeline.map((e) => e.kind)).toEqual(['own-goal', 'penalty']);
  });

  it('leaves a whistle unattributed', async () => {
    respondWith({
      header,
      keyEvents: [event({ type: { type: 'halftime' }, text: 'First Half ends.', team: undefined })],
    });

    const summary = await fetchMatchSummary('eng.1', '1');

    expect(summary.timeline[0].kind).toBe('period');
    expect(summary.timeline[0].side).toBeUndefined();
  });
});

describe('statistics', () => {
  const withStats = (name: string, home: string, away: string) => ({
    header,
    boxscore: {
      teams: [
        { homeAway: 'home', statistics: [{ name, displayValue: home }] },
        { homeAway: 'away', statistics: [{ name, displayValue: away }] },
      ],
    },
  });

  // possessionPct arrives as 52.6 while passPct arrives as 0.7, so formatting
  // them the same way would report 70% passing as 1%.
  it('formats possession and the fractional percentages differently', async () => {
    respondWith(withStats('possessionPct', '52.6', '47.4'));
    expect((await fetchMatchSummary('eng.1', '1')).stats[0].home).toBe('52.6%');

    respondWith(withStats('passPct', '0.7', '0.84'));
    expect((await fetchMatchSummary('eng.1', '1')).stats[0].home).toBe('70%');
  });

  // The bar is filled by both teams, so a 0-2 is all away colour. Both teams on
  // zero has to be distinguishable from that rather than drawn as an even split.
  it('marks a measure neither side has recorded as unrecorded', async () => {
    respondWith(withStats('wonCorners', '0', '0'));

    const summary = await fetchMatchSummary('eng.1', '1');

    expect(summary.stats[0].recorded).toBe(false);
  });

  it('gives the whole bar to one side when the other is on zero', async () => {
    respondWith(withStats('wonCorners', '0', '2'));

    const summary = await fetchMatchSummary('eng.1', '1');

    expect(summary.stats[0]).toMatchObject({ homeShare: 0, recorded: true });
  });
});

describe('lineups', () => {
  it('are absent until ESPN publishes them', async () => {
    respondWith({ header, rosters: [{ homeAway: 'home', roster: [] }] });

    expect((await fetchMatchSummary('eng.1', '1')).lineups).toBeUndefined();
  });

  it('separate the starting eleven from the bench', async () => {
    respondWith({
      header,
      rosters: ['home', 'away'].map((homeAway) => ({
        homeAway,
        formation: '4-4-2',
        roster: [
          { starter: true, jersey: '1', formationPlace: '1', position: { abbreviation: 'G' }, athlete: { id: 'a', shortName: 'A. One' } },
          { starter: false, jersey: '12', formationPlace: '0', position: { abbreviation: 'F' }, athlete: { id: 'b', shortName: 'B. Two' }, subbedIn: true },
        ],
      })),
    });

    const summary = await fetchMatchSummary('eng.1', '1');

    expect(summary.lineups?.home.formation).toBe('4-4-2');
    expect(summary.lineups?.home.starters.map((p) => p.name)).toEqual(['A. One']);
    expect(summary.lineups?.home.bench[0].subbedIn).toBe(true);
  });
});

describe('failure', () => {
  it('reports the status code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(fetchMatchSummary('eng.1', '1')).rejects.toThrow('HTTP 404');
  });
});
