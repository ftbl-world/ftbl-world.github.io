import type { EventKind, MatchHeader, TimelineEvent } from '../api/match';

// A glyph per event type. Cards are drawn in CSS so they can be coloured;
// everything else is a character, which keeps this free of icon assets.
const GLYPH: Record<EventKind, string> = {
  goal: '⚽',
  'own-goal': '⚽',
  penalty: '⚽',
  yellow: '',
  red: '',
  substitution: '⇄',
  period: '⏱',
  other: '•',
};

const DESCRIPTION: Record<EventKind, string> = {
  goal: 'Goal',
  'own-goal': 'Own goal',
  penalty: 'Penalty',
  yellow: 'Yellow card',
  red: 'Red card',
  substitution: 'Substitution',
  period: '',
  other: '',
};

/**
 * The headline for a row. ESPN's full sentence is long enough to wrap three
 * times on a phone, so the players carry the row and the sentence is the title.
 */
const summarise = (event: TimelineEvent): string => {
  if (event.participants.length === 0) return event.text;

  const [first, second] = event.participants;
  if (event.kind === 'substitution') return second ? `${first} for ${second}` : first;
  if (second && (event.kind === 'goal' || event.kind === 'penalty')) {
    return `${first} (assist ${second})`;
  }
  return first;
};

function Entry({ event }: { event: TimelineEvent }) {
  const note = DESCRIPTION[event.kind];

  return (
    <span className="timeline__entry">
      <span className={`timeline__icon timeline__icon--${event.kind}`}>
        {event.kind === 'yellow' || event.kind === 'red' ? (
          <span className="timeline__card" />
        ) : (
          GLYPH[event.kind]
        )}
      </span>
      <span className="timeline__detail">
        <span className="timeline__label">{summarise(event)}</span>
        {note && <span className="timeline__note">{note}</span>}
      </span>
    </span>
  );
}

function Timeline({
  events,
  header,
}: {
  events: TimelineEvent[];
  header: MatchHeader;
}) {
  return (
    <ol className="timeline">
      <li className="timeline__legend">
        <span>{header.home.abbreviation || header.home.name}</span>
        <span>{header.away.abbreviation || header.away.name}</span>
      </li>

      {events.map((event) => (
        <li key={event.id} className="timeline__row" title={event.text}>
          {/* The clock holds the middle column at every row, so the match still
              reads top to bottom while each side keeps its own column. */}
          <span className="timeline__side timeline__side--home">
            {event.side === 'home' && <Entry event={event} />}
          </span>

          <span className="timeline__clock">{event.clock}</span>

          <span className="timeline__side timeline__side--away">
            {event.side === 'away' && <Entry event={event} />}
          </span>

          {!event.side && (
            <span className="timeline__neutral">{summarise(event)}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

export default Timeline;
