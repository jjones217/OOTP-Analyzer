import { useEffect, useState } from 'react';
import { BatterEvaluator } from './BatterEvaluator';
import { PitcherEvaluator } from './PitcherEvaluator';

const MODE_KEY = 'ootp-eval-mode';

export function PlayerEvaluator() {
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'pitcher' ? 'pitcher' : 'batter';
    } catch {
      return 'batter';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch { /* non-fatal */ }
  }, [mode]);

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm font-medium">
          {[['batter', 'Batter'], ['pitcher', 'Pitcher']].map(([id, label]) => (
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
      {mode === 'pitcher' ? <PitcherEvaluator /> : <BatterEvaluator />}
    </div>
  );
}
