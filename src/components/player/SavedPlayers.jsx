import { useMemo, useRef, useState } from 'react';
import { LEAGUE_LEVELS } from '../../lib/evaluation';
import { loadSavedPlayers, deleteSavedPlayer, loadIntoEvaluator } from '../../lib/savedPlayers';
import { addPlayerToTrade, tradeSideLabels } from '../../lib/tradeStore';
import { faOffer } from '../../lib/tradeValue';
import { Section } from './formControls';

const TYPE_BADGE = {
  batter: { label: 'B', className: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' },
  pitcher: { label: 'P', className: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' },
};

// onLoaded(type) — parent switches to that evaluator tab and remounts it.
export function SavedPlayers({ onLoaded }) {
  const [players, setPlayers] = useState(loadSavedPlayers);
  const labels = useMemo(() => tradeSideLabels(), []);
  const [feedback, setFeedback] = useState(null);
  const timer = useRef(null);

  const flash = (msg) => {
    setFeedback(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 2500);
  };

  const handleLoad = (entry) => {
    loadIntoEvaluator(entry);
    onLoaded(entry.type);
  };

  const handleTrade = (entry, sideKey) => {
    const s = entry.summary;
    const label = addPlayerToTrade(
      {
        name: s.name,
        ovr: s.ovr === null || s.ovr === undefined ? '' : String(s.ovr),
        pot: s.pot === null || s.pot === undefined ? '' : String(s.pot),
        age: s.age ?? '',
        level: s.level ?? 'mlb',
        controlYears: '',
        salary: '',
        injury: 'normal',
        scale: '20-80',
      },
      sideKey
    );
    flash(`Added ${s.name} to “${label}”.`);
  };

  const handleDelete = (entry) => setPlayers(deleteSavedPlayer(entry.id));

  if (players.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 space-y-2">
        <p className="text-4xl">📋</p>
        <p className="text-gray-500 dark:text-gray-400">No saved players yet.</p>
        <p className="text-sm text-gray-400">
          Evaluate a batter or pitcher, then hit <span className="font-medium">Save player</span> on the result card.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Section
        title={`Saved players (${players.length})`}
        subtitle="Load puts the full evaluation back into its card. Re-saving a player with the same name updates their entry."
      >
        {feedback && <p className="mb-2 text-xs text-green-600 dark:text-green-400">{feedback}</p>}
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {players.map((entry) => {
            const s = entry.summary;
            const badge = TYPE_BADGE[entry.type] ?? TYPE_BADGE.batter;
            const offer = faOffer(
              { ovr: s.ovr, pot: s.pot, age: s.age, level: s.level, scale: '20-80' },
              '20-80'
            );
            return (
              <li key={entry.id} className="py-3 flex items-center gap-3 flex-wrap">
                <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${badge.className}`}>
                  {badge.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{s.name}</div>
                  <div className="text-xs text-gray-400">
                    {s.detail}
                    {s.age && ` · ${s.age} yrs`}
                    {' · '}
                    {LEAGUE_LEVELS.find((l) => l.id === s.level)?.label ?? s.level}
                    {offer && !offer.minimum && ` · FA: ${offer.years} yr × $${offer.aav}M`}
                    {offer?.minimum && ' · FA: league min'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{s.ovr ?? '—'}</span>
                  {s.pot !== null && s.pot !== undefined && (
                    <span className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400"> / {s.pot}</span>
                  )}
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 -mt-0.5">ovr / pot</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleLoad(entry)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Load
                  </button>
                  {[['sideA', labels.sideA], ['sideB', labels.sideB]].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => handleTrade(entry, key)}
                      title={`Add to “${label}”`}
                      className="px-2 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                    >
                      + {label}
                    </button>
                  ))}
                  <button
                    onClick={() => handleDelete(entry)}
                    aria-label={`Delete ${s.name}`}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 text-lg leading-none px-1"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
