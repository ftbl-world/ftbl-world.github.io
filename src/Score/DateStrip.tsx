import { useSyncExternalStore } from 'react';
import { addDays, describeDayShort, fromInputValue, isSameDay, toInputValue } from '../api/dates';
import './DateStrip.scss';

// Three days either side of today covers the weekend round from midweek, which
// is the common case; the picker handles anything further out. A phone only has
// room for yesterday, today and tomorrow.
const DAY_RANGE = 3;
const NARROW_DAY_RANGE = 1;

// Matches the phone breakpoint the stylesheets use.
const NARROW = '(max-width: 650px)';

const subscribeToWidth = (onChange: () => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

const useIsNarrow = () =>
  useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(NARROW).matches,
    () => false
  );

interface DateStripProps {
  selected: Date;
  today: Date;
  onSelect: (date: Date) => void;
  liveOnly: boolean;
  onLiveOnlyChange: (liveOnly: boolean) => void;
  liveCount: number;
}

function DateStrip({
  selected,
  today,
  onSelect,
  liveOnly,
  onLiveOnlyChange,
  liveCount,
}: DateStripProps) {
  const range = useIsNarrow() ? NARROW_DAY_RANGE : DAY_RANGE;

  // Anchored on today rather than the selection, so the strip does not crawl
  // away as a date further out is picked.
  const days = Array.from({ length: range * 2 + 1 }, (_, index) =>
    addDays(today, index - range)
  );

  // A date outside the strip still needs to show as selected somewhere.
  const isOffStrip = !days.some((day) => isSameDay(day, selected));

  return (
    <div className="dateStrip">
      <div className="dateStrip__days" role="tablist" aria-label="Match date">
        {days.map((day) => {
          const active = isSameDay(day, selected);
          return (
            <button
              key={day.getTime()}
              type="button"
              role="tab"
              aria-selected={active}
              className={`dateStrip__day${active ? ' dateStrip__day--active' : ''}`}
              onClick={() => onSelect(day)}
            >
              {describeDayShort(day, today)}
            </button>
          );
        })}

        <label className="dateStrip__picker">
          <span className="sr-only">Pick a date</span>
          <input
            type="date"
            value={toInputValue(selected)}
            onChange={(event) => {
              const date = fromInputValue(event.target.value);
              if (date) onSelect(date);
            }}
          />
        </label>
      </div>

      <div className="dateStrip__filters">
        {isOffStrip && (
          <span className="dateStrip__showing">{describeDayShort(selected, today)}</span>
        )}
        <button
          type="button"
          aria-pressed={liveOnly}
          className={`dateStrip__live${liveOnly ? ' dateStrip__live--active' : ''}`}
          onClick={() => onLiveOnlyChange(!liveOnly)}
        >
          <span className="dateStrip__live__dot" />
          Live
          {liveCount > 0 && <span className="dateStrip__live__count">{liveCount}</span>}
        </button>
      </div>
    </div>
  );
}

export default DateStrip;
