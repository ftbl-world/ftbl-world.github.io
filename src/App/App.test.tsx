import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startOfDay } from '../api/dates';
import { toDateParam } from '../api/espn';
import App from './App';

const fixture = (id: string, date: string, home: string, away: string) => ({
  id,
  date,
  competitions: [
    {
      status: { type: { state: 'pre' } },
      competitors: [
        { homeAway: 'home', score: '0', team: { displayName: home, logo: 'h.png' } },
        { homeAway: 'away', score: '0', team: { displayName: away, logo: 'a.png' } },
      ],
    },
  ],
});

// Two kickoffs on different local days, so grouping has something to separate.
const scoreboard = {
  events: [
    fixture('1', '2030-05-18T14:00:00Z', 'Chelsea', 'Arsenal'),
    fixture('2', '2030-05-19T14:00:00Z', 'Everton', 'Fulham'),
  ],
};

const laLiga = {
  events: [fixture('3', '2030-05-18T18:00:00Z', 'Sevilla', 'Valencia')],
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const failed = (status: number) => ({ ok: false, status, json: async () => ({}) });

// Retries are deliberate in production, so error states take a beat to settle.
const SETTLE = { timeout: 5000 };

beforeEach(() => {
  // Pins "today" to the first fixture's local day so the relative labels are
  // deterministic wherever the suite runs.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2030-05-18T09:00:00Z'));
  localStorage.setItem('ftbl-selected-league', 'eng.1');
  // Opening a match navigates, and jsdom keeps one location for the whole
  // file, so without this every test after the first click starts on the match
  // page instead of the board.
  window.history.pushState({}, '', '/');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(scoreboard)));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('heads only the fixtures that fall outside the selected day', async () => {
  render(<App />);

  const table = await screen.findByRole('table');
  expect(within(table).getByText('Chelsea')).toBeInTheDocument();
  expect(within(table).getByText('Fulham')).toBeInTheDocument();

  // The strip already names the selected day, so repeating it is noise...
  expect(within(table).queryByText('Today')).not.toBeInTheDocument();
  // ...but a fixture ESPN returns on the following local day still needs saying.
  expect(within(table).getByText('Tomorrow')).toBeInTheDocument();
});

it('shows a kickoff time rather than a scoreline before a match starts', async () => {
  render(<App />);

  expect(await screen.findByText('Chelsea')).toBeInTheDocument();
  expect(screen.queryByText('0 - 0')).not.toBeInTheDocument();
});

it('offers every competition in the strip and marks the active one', async () => {
  render(<App />);

  const strip = await screen.findByRole('tablist', { name: 'Competition' });
  const tabs = within(strip).getAllByRole('tab');

  expect(tabs.map((tab) => tab.textContent)).toContain('All Leagues');
  expect(tabs.map((tab) => tab.textContent)).toContain('Premier League');
  expect(within(strip).getByRole('tab', { name: 'Premier League' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

it('switches competition when another is picked', async () => {
  render(<App />);

  const strip = await screen.findByRole('tablist', { name: 'Competition' });
  fireEvent.click(within(strip).getByRole('tab', { name: 'All Leagues' }));

  expect(within(strip).getByRole('tab', { name: 'All Leagues' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(localStorage.getItem('ftbl-selected-league')).toBe('AllLeagues');
});

it('shows an error when every league fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failed(500)));

  render(<App />);

  expect(
    await screen.findByText('Cannot fetch the data right now.', undefined, SETTLE),
  ).toBeInTheDocument();
});

it('keeps the rest of the board when one league fails', async () => {
  localStorage.setItem('ftbl-selected-league', 'AllLeagues');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.includes('/eng.1/')) return Promise.resolve(failed(403));
      if (url.includes('/esp.1/')) return Promise.resolve(ok(laLiga));
      return Promise.resolve(ok({ events: [] }));
    }),
  );

  render(<App />);

  // La Liga still renders its fixture...
  expect(await screen.findByText('Sevilla', undefined, SETTLE)).toBeInTheDocument();
  // ...while the Premier League reports its own failure in place.
  expect(await screen.findByText('Scores unavailable right now.', undefined, SETTLE)).toBeInTheDocument();
  // ...and the page-wide error stays away.
  expect(screen.queryByText('Cannot fetch the data right now.')).not.toBeInTheDocument();
});

it('opens the match page and keeps its statistics through a failed refresh', async () => {
  const liveMatch = {
    events: [
      {
        id: '77',
        date: '2030-05-18T14:00:00Z',
        competitions: [
          {
            status: { type: { state: 'in', name: 'STATUS_FIRST_HALF' }, displayClock: "34'" },
            competitors: [
              { homeAway: 'home', score: '1', team: { id: '1', displayName: 'Chelsea', logo: '' } },
              { homeAway: 'away', score: '0', team: { id: '2', displayName: 'Arsenal', logo: '' } },
            ],
          },
        ],
      },
    ],
  };
  const summary = {
    boxscore: {
      teams: [
        {
          homeAway: 'home',
          team: { id: '1' },
          statistics: [
            { name: 'possessionPct', displayValue: '58' },
            { name: 'totalShots', displayValue: '10' },
            { name: 'shotsOnTarget', displayValue: '4' },
            { name: 'totalPasses', displayValue: '401' },
          ],
        },
        {
          homeAway: 'away',
          team: { id: '2' },
          statistics: [
            { name: 'possessionPct', displayValue: '42' },
            { name: 'totalShots', displayValue: '6' },
            { name: 'shotsOnTarget', displayValue: '1' },
            { name: 'totalPasses', displayValue: '250' },
          ],
        },
      ],
    },
    header: {
      league: { name: 'Premier League' },
      competitions: [
        {
          status: { type: { state: 'in', detail: "34'" } },
          competitors: [
            { homeAway: 'home', score: '1', team: { id: '1', displayName: 'Chelsea', abbreviation: 'CHE' } },
            { homeAway: 'away', score: '0', team: { id: '2', displayName: 'Arsenal', abbreviation: 'ARS' } },
          ],
        },
      ],
    },
  };

  let summaryFails = false;
  let summaryCalls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.includes('/summary')) {
        summaryCalls += 1;
        return Promise.resolve(summaryFails ? failed(500) : ok(summary));
      }
      return Promise.resolve(ok(liveMatch));
    }),
  );

  render(<App />);

  fireEvent.click((await screen.findByText('Chelsea')).closest('tr')!);

  // The row is a link to a page of its own now, not a dialog over the board.
  expect(window.location.pathname).toBe('/match/eng.1/77');
  expect(await screen.findByText('58%', undefined, SETTLE)).toBeInTheDocument();

  // The live poll now runs into a failing endpoint.
  summaryFails = true;
  const callsBefore = summaryCalls;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(40_000);
  });

  // Without a refetch actually happening, the assertions below prove nothing.
  expect(summaryCalls).toBeGreaterThan(callsBefore);

  // Previously this blanked the whole statistics block.
  expect(screen.getByText('58%')).toBeInTheDocument();
  expect(screen.getByText('401')).toBeInTheDocument();
});

it('requests the selected date and nothing else', async () => {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      urls.push(url);
      return Promise.resolve(ok(scoreboard));
    }),
  );

  render(<App />);
  await screen.findByText('Chelsea');

  // 2030-05-18 is the pinned "today".
  expect(urls.every((url) => url.includes('dates=20300518'))).toBe(true);

  urls.length = 0;
  const strip = await screen.findByRole('tablist', { name: 'Match date' });
  fireEvent.click(within(strip).getByRole('tab', { name: 'Yesterday' }));

  await vi.waitFor(() => expect(urls.length).toBeGreaterThan(0));
  expect(urls.every((url) => url.includes('dates=20300517'))).toBe(true);
});

it('does not poll a date that has already passed', async () => {
  let polls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.includes('/scoreboard')) polls += 1;
      return Promise.resolve(ok(scoreboard));
    }),
  );

  render(<App />);
  const strip = await screen.findByRole('tablist', { name: 'Match date' });
  fireEvent.click(within(strip).getByRole('tab', { name: 'Yesterday' }));
  await vi.waitFor(() => expect(polls).toBeGreaterThan(0));

  const settled = polls;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120_000);
  });

  expect(polls).toBe(settled);
});

it('narrows the board to matches in progress', async () => {
  const mixed = {
    events: [
      {
        id: '10',
        date: '2030-05-18T14:00:00Z',
        competitions: [
          {
            status: { type: { state: 'in', name: 'STATUS_SECOND_HALF' }, displayClock: "67'" },
            competitors: [
              { homeAway: 'home', score: '2', team: { displayName: 'Playing Now', logo: '' } },
              { homeAway: 'away', score: '1', team: { displayName: 'Also Playing', logo: '' } },
            ],
          },
        ],
      },
      {
        id: '11',
        date: '2030-05-18T19:00:00Z',
        competitions: [
          {
            status: { type: { state: 'pre' } },
            competitors: [
              { homeAway: 'home', score: '0', team: { displayName: 'Later Today', logo: '' } },
              { homeAway: 'away', score: '0', team: { displayName: 'Kicks Off Later', logo: '' } },
            ],
          },
        ],
      },
    ],
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(mixed)));

  render(<App />);
  expect(await screen.findByText('Later Today')).toBeInTheDocument();

  // The filter advertises how many are in progress before it is used.
  const live = screen.getByRole('button', { name: /Live/ });
  expect(live).toHaveTextContent('1');

  fireEvent.click(live);

  expect(screen.getByText('Playing Now')).toBeInTheDocument();
  expect(screen.queryByText('Later Today')).not.toBeInTheDocument();
});

it('returns to today when the live filter is switched on', async () => {
  render(<App />);

  const dates = await screen.findByRole('tablist', { name: 'Match date' });
  fireEvent.click(within(dates).getByRole('tab', { name: 'Yesterday' }));
  expect(within(dates).getByRole('tab', { name: 'Yesterday' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  fireEvent.click(screen.getByRole('button', { name: /Live/ }));

  expect(within(dates).getByRole('tab', { name: 'Today' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

// Counts scoreboard requests for the selected league while time is advanced, so
// the polling tiers are measured by what they actually cost.
const countPolls = async (status: unknown, advanceMs: number) => {
  const board = {
    events: [
      {
        id: '5',
        date: '2030-05-18T14:00:00Z',
        competitions: [
          {
            status,
            competitors: [
              { homeAway: 'home', score: '1', team: { displayName: 'Chelsea', logo: '' } },
              { homeAway: 'away', score: '0', team: { displayName: 'Arsenal', logo: '' } },
            ],
          },
        ],
      },
    ],
  };

  let polls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.includes('/scoreboard')) polls += 1;
      return Promise.resolve(ok(board));
    }),
  );

  render(<App />);
  await screen.findByText('Chelsea');
  const initial = polls;

  await act(async () => {
    await vi.advanceTimersByTimeAsync(advanceMs);
  });

  return polls - initial;
};

it('polls a league with a match in progress', async () => {
  const refetches = await countPolls(
    { type: { state: 'in', name: 'STATUS_FIRST_HALF' }, displayClock: "34'" },
    45_000,
  );

  expect(refetches).toBeGreaterThanOrEqual(2);
});

it('stops polling a league whose matches have all finished', async () => {
  const refetches = await countPolls({ type: { state: 'post', completed: true } }, 120_000);

  expect(refetches).toBe(0);
});

it('paints cached scores before the network answers', async () => {
  localStorage.setItem(
    `ftbl-scores-eng.1-${toDateParam(startOfDay(new Date()))}`,
    JSON.stringify({
      at: Date.now(),
      data: {
        leagueID: 'eng.1',
        name: 'Premier League',
        matches: [
          {
            matchID: '9',
            eventID: '9',
            leagueID: 'eng.1',
            time: { state: 'FT', status: '2030-05-18T14:00:00Z', phase: 'post' },
            homeTeam: 'Cached United',
            awayTeam: 'Cached City',
            homeScore: '2',
            awayScore: '1',
            homePenaltyScore: '',
            awayPenaltyScore: '',
            homeTeamLogoUrl: '',
            awayTeamLogoUrl: '',
          },
        ],
      },
    }),
  );
  // Never resolves, so anything on screen can only have come from the cache.
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

  render(<App />);

  expect(screen.getByText('Cached United')).toBeInTheDocument();
  expect(screen.getByText('2 - 1')).toBeInTheDocument();
});
