import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  // Pins "today" to the first fixture's local day so the relative labels are
  // deterministic wherever the suite runs.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2030-05-18T09:00:00Z'));
  localStorage.setItem('ftbl-selected-league', 'eng.1');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => scoreboard }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

it('groups fixtures under relative date headings', async () => {
  render(<App />);

  expect(await screen.findByText('Chelsea')).toBeInTheDocument();
  expect(screen.getByText('Fulham')).toBeInTheDocument();
  expect(screen.getByText('Today')).toBeInTheDocument();
  expect(screen.getByText('Tomorrow')).toBeInTheDocument();
});

it('shows a kickoff time rather than a scoreline before a match starts', async () => {
  render(<App />);

  expect(await screen.findByText('Chelsea')).toBeInTheDocument();
  expect(screen.queryByText('0 - 0')).not.toBeInTheDocument();
});

it('offers every competition in the selector', async () => {
  render(<App />);

  const select = await screen.findByLabelText('Competition');
  expect(within(select).getByRole('option', { name: 'All Leagues' })).toBeInTheDocument();
  expect(within(select).getByRole('option', { name: 'Premier League' })).toBeInTheDocument();
  expect(select).toHaveValue('eng.1');
});

it('shows an error when the scoreboard cannot be reached', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
  );

  render(<App />);

  expect(await screen.findByText('Cannot fetch the data right now.')).toBeInTheDocument();
});
