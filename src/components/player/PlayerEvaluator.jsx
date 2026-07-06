import { useEffect, useState } from 'react';
import { BatterEvaluator } from './BatterEvaluator';
import { PitcherEvaluator } from './PitcherEvaluator';
import { SavedPlayers } from './SavedPlayers';
import { TradeAnalyzer } from '../trade/TradeAnalyzer';

const MODE_KEY = 'ootp-eval-mode';
const MODES = ['batter', 'pitcher', 'trade', 'saved'];

export function PlayerEvaluator() {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      return MODES.includes(saved) ? saved : 'batter';
    } catch {
      return 'batter';
    }
  });
  // Bumped when a saved player is loaded, so the target evaluator remounts
  // and re-reads its localStorage even if it was already the active tab.
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch { /* non-fatal */ }
  }, [mode]);

  const handleLoaded = (type) => {
    setMode(type);
    setLoadKey((k) => k + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm font-medium">
          {[['batter', 'Batter'], ['pitcher', 'Pitcher'], ['trade', 'Trade'], ['saved', 'Saved']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`px-6 py-2 ${
                mode === id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'trade' ? (
        <TradeAnalyzer />
      ) : mode === 'saved' ? (
        <SavedPlayers onLoaded={handleLoaded} />
      ) : mode === 'pitcher' ? (
        <PitcherEvaluator key={`p${loadKey}`} />
      ) : (
        <BatterEvaluator key={`b${loadKey}`} />
      )}
    </div>
  );
}
