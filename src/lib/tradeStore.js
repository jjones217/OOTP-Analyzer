// Shared localStorage store for the current trade, so the batter/pitcher
// evaluators can push players into it while the trade page isn't mounted.

const KEY = 'ootp-trade-analyzer';

export const EMPTY_PLAYER = {
  name: '', ovr: '', pot: '', age: '', level: 'mlb', controlYears: '', salary: '', injury: 'normal',
};

const EMPTY_TRADE = {
  scale: '20-80',
  sideA: { label: 'You receive', players: [{ ...EMPTY_PLAYER }] },
  sideB: { label: 'You give up', players: [{ ...EMPTY_PLAYER }] },
  bench: [],
};

export function loadTradeState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_TRADE;
    const saved = JSON.parse(raw);
    return {
      ...EMPTY_TRADE,
      ...saved,
      sideA: { ...EMPTY_TRADE.sideA, ...saved.sideA },
      sideB: { ...EMPTY_TRADE.sideB, ...saved.sideB },
      bench: saved.bench ?? [],
    };
  } catch {
    return EMPTY_TRADE;
  }
}

export function saveTradeState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage full/blocked — the in-memory state still works */ }
}

export function emptyTradeState() {
  return {
    ...EMPTY_TRADE,
    sideA: { ...EMPTY_TRADE.sideA, players: [{ ...EMPTY_PLAYER }] },
    sideB: { ...EMPTY_TRADE.sideB, players: [{ ...EMPTY_PLAYER }] },
    bench: [],
  };
}

const isBlankPlayer = (p) => !p.name && !p.ovr && !p.pot && !p.age;

// Add a player to one side of the stored trade (replacing the placeholder
// row if the side is still empty). Returns the side's label for feedback.
export function addPlayerToTrade(player, sideKey) {
  const state = loadTradeState();
  const side = state[sideKey];
  const players =
    side.players.length === 1 && isBlankPlayer(side.players[0])
      ? [player]
      : [...side.players, player];
  saveTradeState({ ...state, [sideKey]: { ...side, players } });
  return side.label;
}

// Current side labels, for buttons rendered outside the trade page.
export function tradeSideLabels() {
  const state = loadTradeState();
  return { sideA: state.sideA.label, sideB: state.sideB.label };
}
