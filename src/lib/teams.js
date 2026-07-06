// localStorage store for teams and their rosters. Roster entries use the
// same { type, form, summary } shape as saved players / CSV imports, so a
// team can be built from any of them.

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

// Upsert players into a roster by (type, name) so re-importing an updated
// export refreshes players instead of duplicating them.
export function mergeIntoRoster(roster, entries) {
  const next = [...roster];
  for (const entry of entries) {
    const name = (entry.summary.name || 'Unnamed').trim().toLowerCase();
    const i = next.findIndex(
      (p) => p.type === entry.type && (p.summary.name || '').trim().toLowerCase() === name
    );
    if (i >= 0) next[i] = entry;
    else next.push(entry);
  }
  return next;
}
