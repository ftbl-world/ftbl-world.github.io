import type { FormResult, MatchHeader, TeamIdentity } from '../api/match';

const day = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

function TeamForm({ team, results }: { team: TeamIdentity; results: FormResult[] }) {
  return (
    <section className="form__team">
      <h3 className="form__name">
        <img src={team.crestUrl} width="20" height="20" alt="" />
        {team.name}
      </h3>

      <ol className="form__results">
        {results.map((result) => (
          <li key={result.id} className="form__row">
            <span className={`form__badge form__badge--${result.result.toLowerCase()}`}>
              {result.result}
            </span>
            <span className="form__opponent">
              {/* ESPN gives "vs" or "@"; spelling it out reads better in a list. */}
              <span className="form__venue">{result.atVs === '@' ? 'Away to' : 'Home to'}</span>
              {result.opponent}
            </span>
            <span className="form__score">{result.score}</span>
            <span className="form__meta">
              {result.competition}
              {result.date && ` · ${day(result.date)}`}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Form({
  form,
  header,
}: {
  form: { home: FormResult[]; away: FormResult[] };
  header: MatchHeader;
}) {
  return (
    <div className="form">
      <TeamForm team={header.home} results={form.home} />
      <TeamForm team={header.away} results={form.away} />
    </div>
  );
}

export default Form;
