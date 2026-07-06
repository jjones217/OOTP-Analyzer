// localStorage list of saved player evaluations. Each entry keeps the full
// evaluator form so it can be reloaded into the card, plus a summary for
// the list view.

const KEY = 'ootp-saved-players';

// The evaluators' own storage keys — loading a saved player writes its form
// snapshot here, then the card remounts and reads it.
export const EVAL_KEYS = { batter: 'ootp-player-eval', pitcher: 'ootp-pitcher-eval' };

export function loadSavedPlayers() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* storage full/blocked */ }
}

// Upsert by (type, name) so re-saving a player updates instead of duplicating.
// entry: { type: 'batter'|'pitcher', form, summary: { name, detail, age, level, ovr, pot } }
export function savePlayer(entry) {
  const list = loadSavedPlayers();
  const name = (entry.summary.name || 'Unnamed').trim() || 'Unnamed';
  const full = {
    ...entry,
    id: `${entry.type}:${name.toLowerCase()}`,
    summary: { ...entry.summary, name },
    savedAt: Date.now(),
  };
  const i = list.findIndex((p) => p.id === full.id);
  const updated = i >= 0;
  if (updated) list[i] = full;
  else list.push(full);
  persist(list);
  return updated;
}

export function deleteSavedPlayer(id) {
  const list = loadSavedPlayers().filter((p) => p.id !== id);
  persist(list);
  return list;
}

// Write a saved entry's form into its evaluator's storage so the card
// picks it up on next mount.
export function loadIntoEvaluator(entry) {
  try {
    localStorage.setItem(EVAL_KEYS[entry.type], JSON.stringify(entry.form));
  } catch { /* storage blocked — the card will just keep its current player */ }
}
