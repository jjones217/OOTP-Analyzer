import { useLeagueData } from '../hooks/useLeagueData';
import { StatsPanel } from './StatsPanel';

function RoleBadge({ role }) {
  const isComm = role === 'commissioner';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      isComm
        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    }`}>
      {isComm ? 'Commissioner' : 'GM'}
    </span>
  );
}

function StatusBadge({ pendingExport }) {
  if (pendingExport) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        Export needed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
      <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
      Up to date
    </span>
  );
}

function Standing({ standing }) {
  if (!standing) return null;
  return (
    <div className="flex gap-3 text-sm mt-1">
      <span className="text-gray-700 dark:text-gray-300 font-medium">
        {standing.w}–{standing.l}
        {standing.t > 0 && `–${standing.t}`}
      </span>
      {standing.gb > 0 && (
        <span className="text-gray-500 dark:text-gray-400">{standing.gb} GB</span>
      )}
      {standing.streak && (
        <span className="text-gray-500 dark:text-gray-400">Streak: {standing.streak}</span>
      )}
    </div>
  );
}

export function LeagueCard({ league, onEdit }) {
  const { data, batStats, pitchStats, loading, error, lastUpdated, refresh } =
    useLeagueData(league);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex flex-col gap-4 p-5 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {league.name}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">
            statsplus.net/{league.lgurl}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <RoleBadge role={league.role} />
          <button
            onClick={onEdit}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && !data && (
        <div className="flex-1 flex items-center justify-center py-8">
          <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          <strong>API error:</strong> {error}
          <button onClick={refresh} className="ml-2 underline text-red-500">Retry</button>
        </div>
      )}

      {data && (
        <>
          {/* Sim status */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Current sim date</p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {data.currentDate ?? '—'}
              </p>
            </div>
            <StatusBadge pendingExport={data.pendingExport} />
          </div>

          {/* My team */}
          {(data.myTeamInfo || data.myStanding) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                My Team
              </p>
              {data.myTeamInfo && (
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {data.myTeamInfo.name}
                  {data.myTeamInfo.nickname && ` ${data.myTeamInfo.nickname}`}
                </p>
              )}
              <Standing standing={data.myStanding} />
            </div>
          )}

          {/* Stats */}
          <StatsPanel batStats={batStats} pitchStats={pitchStats} />
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
        <span className="text-xs text-gray-400">
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString()}`
            : 'Not yet loaded'}
        </span>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-40"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
