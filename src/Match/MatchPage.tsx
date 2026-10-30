import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../Header/Header';
import { useMatchSummary } from '../api/queries';
import type { MatchSummary } from '../api/match';
import Commentary from './Commentary';
import Form from './Form';
import Lineups from './Lineups';
import Scoreline from './Scoreline';
import Stats from './Stats';
import Table from './Table';
import Timeline from './Timeline';
import './MatchPage.scss';

type TabID = 'timeline' | 'lineups' | 'stats' | 'table' | 'form' | 'commentary';

interface Tab {
  id: TabID;
  label: string;
  /** A tab with nothing behind it is hidden rather than shown empty. */
  available: (summary: MatchSummary) => boolean;
}

const TABS: Tab[] = [
  { id: 'timeline', label: 'Timeline', available: (s) => s.timeline.length > 0 },
  { id: 'lineups', label: 'Lineups', available: (s) => Boolean(s.lineups) },
  { id: 'stats', label: 'Stats', available: (s) => s.stats.length > 0 },
  { id: 'table', label: 'Table', available: (s) => s.table.length > 0 },
  { id: 'form', label: 'Form', available: (s) => Boolean(s.form) },
  { id: 'commentary', label: 'Commentary', available: (s) => s.commentary.length > 0 },
];

function MatchPage() {
  const { leagueID, eventID } = useParams<{ leagueID: string; eventID: string }>();
  const { data, isPending, isError } = useMatchSummary(leagueID, eventID);
  const [requested, setRequested] = useState<TabID | undefined>(undefined);

  const tabs = data ? TABS.filter((tab) => tab.available(data)) : [];
  // Before kickoff there is no timeline, so the first tab that has anything
  // behind it becomes the default rather than landing on an empty one.
  const active = tabs.find((tab) => tab.id === requested)?.id ?? tabs[0]?.id;

  return (
    <div className="matchPage">
      <Header />

      <div className="matchPage__body">
        <div className="matchPage__content">
          <Link className="matchPage__back" to="/">
            <span aria-hidden="true">&#8249;</span> All scores
          </Link>

          {isPending && <p className="matchPage__message">Loading match…</p>}
          {isError && <p className="matchPage__message">Could not load this match.</p>}

          {data && (
            <>
              <Scoreline header={data.header} />

              {tabs.length > 0 && (
                <div className="matchPage__tabs" role="tablist" aria-label="Match detail">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={tab.id === active}
                      className={`matchPage__tab${tab.id === active ? ' matchPage__tab--active' : ''}`}
                      onClick={() => setRequested(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="matchPage__panel">
                {active === 'timeline' && (
                  <Timeline events={data.timeline} header={data.header} />
                )}
                {active === 'lineups' && data.lineups && (
                  <Lineups lineups={data.lineups} header={data.header} />
                )}
                {active === 'stats' && <Stats rows={data.stats} header={data.header} />}
                {active === 'table' && (
                  <Table rows={data.table} header={data.header} />
                )}
                {active === 'form' && data.form && (
                  <Form form={data.form} header={data.header} />
                )}
                {active === 'commentary' && <Commentary entries={data.commentary} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MatchPage;
