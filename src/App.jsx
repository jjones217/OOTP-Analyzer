import { useState } from 'react';
import { useLeagues } from './hooks/useLeagues';
import { LeagueCard } from './components/LeagueCard';
import { LeagueModal } from './components/LeagueModal';

export default function App() {
  const { leagues, loading, addLeague, updateLeague, removeLeague } = useLeagues();
  const [modal, setModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', league }

  function openAdd() { setModal({ mode: 'add' }); }
  function openEdit(league) { setModal({ mode: 'edit', league }); }
  function closeModal() { setModal(null); }

  async function handleSave(data) {
    if (modal?.mode === 'edit') {
      await updateLeague(modal.league.id, data);
    } else {
      await addLeague(data);
    }
  }

  async function handleDelete() {
    if (modal?.mode === 'edit') {
      await removeLeague(modal.league.id);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Nav */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚾</span>
            <div>
              <h1 className="text-xl font-bold leading-none text-gray-900 dark:text-gray-100">
                OOTP League Dashboard
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">Powered by StatsPlus</p>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span className="text-lg leading-none">+</span> Add League
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
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
      </main>

      {/* Modal */}
      {modal && (
        <LeagueModal
          initial={modal.mode === 'edit' ? modal.league : null}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : null}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
