import { useEffect, useRef } from 'react';
import { League } from '../api/espn';
import './LeagueStrip.scss';

export const ALL_LEAGUES = 'AllLeagues';

interface LeagueStripProps {
  leagues: League[];
  active: string;
  onSelect: (leagueID: string) => void;
  /** Fixture counts per league, so empty competitions can be de-emphasised. */
  counts: Record<string, number>;
}

function LeagueStrip({ leagues, active, onSelect, counts }: LeagueStripProps) {
  const options = [{ leagueID: ALL_LEAGUES, name: 'All Leagues' }, ...leagues];
  const activeRef = useRef<HTMLButtonElement>(null);

  // A saved competition near the end of the strip would otherwise load off
  // screen. `block: nearest` keeps this from scrolling the page vertically.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [active]);

  return (
    <div className="leagueStrip" role="tablist" aria-label="Competition">
      {options.map((option) => {
        const isActive = option.leagueID === active;
        // Only competitions with nothing on the selected date are dimmed; the
        // All Leagues tab has no count of its own.
        const isEmpty =
          option.leagueID !== ALL_LEAGUES && counts[option.leagueID] === 0;

        return (
          <button
            key={option.leagueID}
            ref={isActive ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={[
              'leagueStrip__item',
              isActive ? 'leagueStrip__item--active' : '',
              isEmpty ? 'leagueStrip__item--empty' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelect(option.leagueID)}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

export default LeagueStrip;
