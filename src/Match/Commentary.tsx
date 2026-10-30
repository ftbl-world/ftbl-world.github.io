import type { CommentaryEntry } from '../api/match';

function Commentary({ entries }: { entries: CommentaryEntry[] }) {
  // ESPN returns these oldest first. While a match is on, the newest line is
  // the one worth reading, so the feed is reversed rather than scrolled.
  const newestFirst = [...entries].sort((a, b) => b.sequence - a.sequence);

  return (
    <ol className="commentary">
      {newestFirst.map((entry) => (
        <li key={entry.sequence} className="commentary__row">
          <span className="commentary__clock">{entry.clock}</span>
          <span className="commentary__text">{entry.text}</span>
        </li>
      ))}
    </ol>
  );
}

export default Commentary;
