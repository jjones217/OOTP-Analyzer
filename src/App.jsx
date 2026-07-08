// The Leagues dashboard is parked for now — see the commented blocks below
// (imports, state, handlers, nav, main view, modal) to bring it back.
// import { useState } from 'react';
// import { useLeagues } from './hooks/useLeagues';
// import { LeagueCard } from './components/LeagueCard';
// import { LeagueModal } from './components/LeagueModal';
import { useState } from 'react';
import { PlayerEvaluator } from './components/player/PlayerEvaluator';
import { useTheme, THEMES } from './hooks/useTheme';
import { getLeagueAdjusted, setLeagueAdjusted } from './lib/evalSettings';

export default function App() {
  const [theme, setTheme] = useTheme();
  const [adjusted, setAdjusted] = useState(getLeagueAdjusted);

  // const { leagues, loading, addLeague, updateLeague, removeLeague } = useLeagues();
  // const [modal, setModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', league }
  // const [view, setView] = useState('leagues'); // 'leagues' | 'evaluator'

  // function openAdd() { setModal({ mode: 'add' }); }
  // function openEdit(league) { setModal({ mode: 'edit', league }); }
  // function closeModal() { setModal(null); }

  // async function handleSave(data) {
  //   if (modal?.mode === 'edit') {
  //     await updateLeague(modal.league.id, data);
  //   } else {
  //     await addLeague(data);
  //   }
  // }

  // async function handleDelete() {
  //   if (modal?.mode === 'edit') {
  //     await removeLeague(modal.league.id);
  //   }
  // }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Nav */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚾</span>
            <div>
              <h1 className="text-xl font-bold leading-none text-gray-900 dark:text-gray-100">
                OOTP Analyzer
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">Player Evaluator</p>
            </div>
            {/* Leagues tab parked with the dashboard:
            <nav className="ml-6 flex gap-1">
              {[['leagues', 'Leagues'], ['evaluator', 'Player Evaluator']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    view === id
                      ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            */}
          </div>
          {/* {view === 'leagues' && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <span className="text-lg leading-none">+</span> Add League
            </button>
          )} */}

          <div className="flex items-center gap-3">
          {/* League type: how the STAT side of grades is anchored. Visible
              ratings (fielding, position, running, stamina, velo, GB%) are
              always used in both modes. */}
          <div
            className="flex items-center gap-1.5"
            title="How stats are graded. Ratings league: raw stats vs MLB-calibrated benchmarks. Stats-only league: league-relative metrics (wRC+, FIP-, ERA+) dominate, so an average player grades ~50 regardless of the league's run environment. Visible ratings — fielding, position, baserunning, stamina, velocity, GB% — always count in both modes."
          >
            <span className="text-xs text-gray-400">League:</span>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium" role="group" aria-label="League type">
              {[[false, 'Ratings'], [true, 'Stats-only']].map(([val, label]) => (
                <button
                  key={label}
                  onClick={() => { setLeagueAdjusted(val); setAdjusted(val); }}
                  aria-pressed={adjusted === val}
                  className={`px-3 py-1.5 ${
                    adjusted === val
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs font-medium" role="group" aria-label="Theme">
            {THEMES.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                aria-pressed={theme === id}
                className={`px-3 py-1.5 ${
                  theme === id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <PlayerEvaluator key={adjusted ? 'league-adjusted' : 'raw'} />
        {/* Leagues view, parked:
        {view === 'evaluator' ? (
          <PlayerEvaluator key={adjusted ? 'league-adjusted' : 'raw'} />
        ) : loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            Loading leagues…
          </div>
        ) : leagues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <span className="text-5xl">🏟️</span>
            <p className="text-gray-500 dark:text-gray-400 text-lg">No leagues yet.</p>
            <button
              onClick={openAdd}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
            >
              Add your first league
            </button>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {leagues.map((league) => (
              <LeagueCard
                key={league.id}
                league={league}
                onEdit={() => openEdit(league)}
              />
            ))}
          </div>
        )}
        */}
      </main>

      {/* Modal, parked:
      {modal && (
        <LeagueModal
          initial={modal.mode === 'edit' ? modal.league : null}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : null}
          onClose={closeModal}
        />
      )}
      */}
    </div>
  );
}
