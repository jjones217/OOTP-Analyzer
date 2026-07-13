// Draft board: a ranked list of prospects built from a draft-class CSV.
// The engine order leans on potential — drafting is about ceilings — and
// the user's manual order persists alongside it.
import { num } from './evaluation.js';

const KEY = 'ootp-draft-board';

export function loadDraftBoard() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (!s || !Array.isArray(s.entries)) return { entries: [] };
    return { entries: s.entries };
  } catch {
    return { entries: [] };
  }
}

export function saveDraftBoard(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage full/blocked — the in-memory board still works */ }
}

// Potential-heavy draft value: 35% present, 65% ceiling, plus a youth
// bonus — a 19-year-old with the same grades outranks a 22-year-old
// (more development runway). Uses whichever engine graded the entry.
export function draftScore(summary) {
  const ovr = summary.ovr ?? null;
  const pot = summary.pot ?? ovr;
  if (ovr === null && pot === null) return null;
  const present = ovr ?? pot;
  const base = 0.35 * present + 0.65 * pot;
  const age = num(summary.age);
  const youth = age === null ? 0 : Math.max(-6, Math.min(6, (21 - age) * 1.5));
  return base + youth;
}

// Rank map by engine order: entry id → 1-based rank.
export function engineRanks(entries) {
  const ranked = [...entries].sort(
    (a, z) => (draftScore(z.summary) ?? -1) - (draftScore(a.summary) ?? -1)
  );
  const map = new Map();
  ranked.forEach((e, i) => map.set(e.id, i + 1));
  return map;
}
