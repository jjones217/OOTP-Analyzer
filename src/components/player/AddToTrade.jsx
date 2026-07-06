import { useMemo, useRef, useState } from 'react';
import { addPlayerToTrade, tradeSideLabels } from '../../lib/tradeStore';
import { faOffer } from '../../lib/tradeValue';

// Action row for the evaluator result cards: save the player to the saved
// list, add them to the current trade, and see a recommended FA offer.
// player: a trade-row shape ({ name, ovr, pot, age, level, ... scale: '20-80' }).
// onSave: optional — saves the full evaluation; returns true if it updated
// an existing entry.
export function AddToTrade({ player, disabled, onSave }) {
  // Labels are read once per mount — the component remounts on tab switches,
  // which is when they could have changed.
  const labels = useMemo(() => tradeSideLabels(), []);
  const [feedback, setFeedback] = useState(null);
  const timer = useRef(null);

  const flash = (msg) => {
    setFeedback(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 2500);
  };

  const add = (sideKey) => {
    const label = addPlayerToTrade(player, sideKey);
    flash(`Added ${player.name || 'player'} to “${label}” — open the Trade tab to see it.`);
  };

  const save = () => {
    const updated = onSave();
    flash(updated ? `Updated “${player.name || 'Unnamed'}” in saved players.` : `Saved ${player.name || 'player'} — see the Saved tab.`);
  };

  const offer = disabled ? null : faOffer(player, '20-80');

  return (
    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2 flex-wrap">
        {onSave && (
          <button
            onClick={save}
            disabled={disabled}
            title={disabled ? 'Enter ratings or stats first' : 'Save this evaluation to the Saved tab'}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Save player
          </button>
        )}
        <span className="text-xs text-gray-400">Add to trade:</span>
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
      {offer && (
        <p className="mt-2 text-xs text-gray-400">
          FA offer:{' '}
          {offer.minimum ? (
            <span className="font-semibold text-gray-600 dark:text-gray-300">league minimum, 1 yr</span>
          ) : (
            <>
              <span className="font-semibold tabular-nums text-gray-600 dark:text-gray-300">
                {offer.years} yr{offer.years > 1 ? 's' : ''} × ${offer.aav}M
              </span>
              {' '}(${offer.total}M total) · walk away above ~${offer.maxAav}M/yr
            </>
          )}
          {offer.ageAssumed && <span className="italic"> — assuming age 27, enter age to sharpen</span>}
        </p>
      )}
      {feedback && (
        <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">{feedback}</p>
      )}
    </div>
  );
}
