// Global evaluation settings, shared by every grading path (evaluator
// cards, CSV import, depth charts, trade values).
//
// League-adjusted mode: grade stats relative to the league (wRC+, FIP-,
// ERA+) instead of raw MLB-calibrated benchmarks. Meant for stats-only
// leagues or leagues whose run environment differs from modern MLB —
// an average player there grades ~50 regardless of the environment.

const KEY = 'ootp-league-adjusted';

let current = false;
try {
  current = typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
} catch { /* no storage — stays off */ }

export function getLeagueAdjusted() {
  return current;
}

export function setLeagueAdjusted(v) {
  current = !!v;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch { /* no storage — applies for this session only */ }
}
