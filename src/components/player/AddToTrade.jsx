import { useMemo, useRef, useState } from 'react';
import { addPlayerToTrade, tradeSideLabels } from '../../lib/tradeStore';

// "Add to current trade" buttons for the evaluator result cards.
// player: a trade-row shape ({ name, ovr, pot, age, level, ... scale: '20-80' }).
export function AddToTrade({ player, disabled }) {
  // Labels are read once per mount — the component remounts on tab switches,
  // which is when they could have changed.
  const labels = useMemo(() => tradeSideLabels(), []);
  const [feedback, setFeedback] = useState(null);
  const timer = useRef(null);

  const add = (sideKey) => {
    const label = addPlayerToTrade(player, sideKey);
    setFeedback(`Added ${player.name || 'player'} to “${label}”`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 2500);
  };

  return (
    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400">Add to current trade:</span>
        {[['sideA', labels.sideA], ['sideB', labels.sideB]].map(([key, label]) => (
          <button
            key={key}
            onClick={() => add(key)}
            disabled={disabled}
            title={disabled ? 'Enter ratings or stats first' : `Add this player to “${label}”`}
            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            + {label}
          </button>
        ))}
      </div>
      {feedback && (
        <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">{feedback} — open the Trade tab to see it.</p>
      )}
    </div>
  );
}
