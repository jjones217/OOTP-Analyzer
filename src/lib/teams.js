// localStorage store for teams and their rosters. Roster entries use the
// same { type, form, summary } shape as saved players / CSV imports, so a
// team can be built from any of them.
import { evaluatePlayer } from './evaluation.js';
import { evaluatePitcher } from './pitchingEvaluation.js';

const KEY = 'ootp-teams';

export function loadTeamsState() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = raw ? JSON.parse(raw) : null;
    if (!s || !Array.isArray(s.teams)) return { teams: [], activeId: null };
    return { teams: s.teams, activeId: s.activeId ?? s.teams[0]?.id ?? null };
  } catch {
    return { teams: [], activeId: null };
  }
}

export function saveTeamsState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* storage full/blocked — in-memory state still works */ }
}

export function newTeam(name) {
  return { id: `team-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, name, players: [] };
}

// Field-level merge: non-empty new values win, old non-empty values survive.
// This is what lets the hitting and pitching exports of the same player be
// imported in either order — a pitcher's (empty) row in the hitting export
// no longer wipes out his pitching data.
const mergeSection = (oldS = {}, newS = {}) => {
  const out = { ...oldS };
  for (const [k, v] of Object.entries(newS)) {
    if (v !== '' && v !== null && v !== undefined) out[k] = v;
    else if (!(k in out)) out[k] = v;
  }
  return out;
};

function mergeEntries(oldE, newE) {
  const form = { ...oldE.form, ...newE.form };
  form.info = mergeSection(oldE.form.info, newE.form.info);
  for (const sec of ['stats', 'ratings', 'fielding', 'pitches', 'other']) {
    if (oldE.form[sec] || newE.form[sec]) form[sec] = mergeSection(oldE.form[sec], newE.form[sec]);
  }
  if (oldE.form.posRatings || newE.form.posRatings) {
    const keys = new Set([
      ...Object.keys(oldE.form.posRatings ?? {}),
      ...Object.keys(newE.form.posRatings ?? {}),
    ]);
    form.posRatings = {};
    for (const k of keys) {
      form.posRatings[k] = mergeSection(oldE.form.posRatings?.[k], newE.form.posRatings?.[k]);
    }
  }
  form.scale = newE.form.scale ?? oldE.form.scale;

  // Re-grade on the merged data so the summary reflects the whole player.
  const evaluation = newE.type === 'pitcher' ? evaluatePitcher(form) : evaluatePlayer(form);
  const summary = mergeSection(oldE.summary, newE.summary);
  summary.ovr = evaluation.overall;
  summary.pot = evaluation.potOverall;

  return { ...newE, form, summary };
}

// Upsert players into a roster by (type, name) so re-importing an updated
// export refreshes players instead of duplicating them.
export function mergeIntoRoster(roster, entries) {
  const next = [...roster];
  for (const entry of entries) {
    const name = (entry.summary.name || 'Unnamed').trim().toLowerCase();
    const i = next.findIndex(
      (p) => p.type === entry.type && (p.summary.name || '').trim().toLowerCase() === name
    );
    if (i >= 0) next[i] = mergeEntries(next[i], entry);
    else next.push(entry);
  }
  return next;
}
