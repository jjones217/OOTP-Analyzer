import { useMemo, useRef, useState } from 'react';
import { FIELD_POSITIONS, RATING_SCALES, LEAGUE_LEVELS, fmt } from '../../lib/evaluation';
import { parsePlayersCsv } from '../../lib/csvImport';
import { buildDepthChart } from '../../lib/depthChart';
import { loadTeamsState, saveTeamsState, newTeam, mergeIntoRoster } from '../../lib/teams';
import { Section, SelectInput, TextInput } from '../player/formControls';

const SEV_STYLE = {
  high: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900',
  medium: 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  low: 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700',
};

// Diamond coordinates in a 440x400 viewBox.
const DIAMOND_SPOTS = {
  C: [220, 352], P: [220, 268], '1B': [326, 222], '2B': [272, 162], SS: [168, 162],
  '3B': [114, 222], LF: [86, 108], CF: [220, 60], RF: [354, 108],
};

function PlayerChip({ label, name, grade, x, y }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x="-52" y="-14" width="104" height="34" rx="8" fill="var(--chart-surface)" stroke="var(--chart-grid)" />
      <text textAnchor="middle" y="-1" fontSize="10" fontWeight="700" fill="var(--chart-ink-2)">
        {label}{grade !== null && grade !== undefined ? ` · ${grade}` : ''}
      </text>
      <text textAnchor="middle" y="13" fontSize="11" fill="var(--chart-ink)">
        {name.length > 16 ? `${name.slice(0, 15)}…` : name}
      </text>
    </g>
  );
}

function DiamondView({ chart }) {
  const sp1 = chart.rotation[0] ?? null;
  return (
    <svg viewBox="0 0 440 400" className="w-full max-w-2xl mx-auto" role="img" aria-label="Depth chart diamond view">
      {/* outfield arc + infield diamond */}
      <path d="M 220 370 L 40 190 A 240 240 0 0 1 400 190 Z" fill="none" stroke="var(--chart-grid)" strokeWidth="1.5" />
      <path d="M 220 350 L 305 265 L 220 180 L 135 265 Z" fill="none" stroke="var(--chart-axis, var(--chart-grid))" strokeWidth="1.5" />
      {Object.entries(DIAMOND_SPOTS).map(([pos, [x, y]]) => {
        if (pos === 'P') {
          return sp1 ? <PlayerChip key="P" label={`SP1${sp1.asSp !== null ? '' : ''}`} name={sp1.name} grade={sp1.asSp} x={x} y={y} /> : null;
        }
        const s = chart.starters[pos];
        return (
          <PlayerChip
            key={pos}
            label={pos}
            name={s ? s.b.name : '— open —'}
            grade={s ? Math.round(s.score) : null}
            x={x}
            y={y}
          />
        );
      })}
    </svg>
  );
}

function ListView({ chart }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Lineup</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-gray-400">
              <th className="text-left font-semibold py-1">Pos</th>
              <th className="text-left font-semibold py-1">Starter</th>
              <th className="text-right font-semibold py-1">Score</th>
              <th className="text-left font-semibold py-1 pl-3">Backup</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_POSITIONS.map((pos) => {
              const s = chart.starters[pos];
              const b = chart.backups[pos];
              return (
                <tr key={pos} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-1.5 font-semibold text-gray-600 dark:text-gray-300">{pos}</td>
                  <td className="py-1.5 text-gray-900 dark:text-gray-100">{s ? s.b.name : <span className="text-red-500">open</span>}</td>
                  <td className="py-1.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{s ? Math.round(s.score) : '—'}</td>
                  <td className="py-1.5 pl-3 text-gray-500 dark:text-gray-400">{b ? `${b.b.name} (${Math.round(b.score)})` : '—'}</td>
                </tr>
              );
            })}
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="py-1.5 font-semibold text-gray-600 dark:text-gray-300">DH</td>
              <td className="py-1.5 text-gray-900 dark:text-gray-100">{chart.dh ? chart.dh.b.name : <span className="text-gray-400">—</span>}</td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{chart.dh ? Math.round(chart.dh.score) : '—'}</td>
              <td className="py-1.5 pl-3 text-gray-400">bench bat</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Rotation</h4>
        <ol className="space-y-1 text-sm">
          {chart.rotation.map((p, i) => (
            <li key={p.name + i} className="flex justify-between border-t border-gray-100 dark:border-gray-800 py-1.5 first:border-t-0">
              <span className="text-gray-900 dark:text-gray-100"><span className="text-gray-400 mr-2">SP{i + 1}</span>{p.name}</span>
              <span className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">{fmt(p.asSp)}</span>
            </li>
          ))}
          {chart.rotation.length === 0 && <li className="text-gray-400">No pitchers on the roster.</li>}
        </ol>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mt-4 mb-1.5">Bullpen</h4>
        <ol className="space-y-1 text-sm">
          {chart.bullpen.map((p, i) => (
            <li key={p.name + i} className="flex justify-between border-t border-gray-100 dark:border-gray-800 py-1.5 first:border-t-0">
              <span className="text-gray-900 dark:text-gray-100">
                <span className="text-gray-400 mr-2">{i === 0 ? 'CL' : i <= 2 ? 'SU' : 'MR'}</span>{p.name}
              </span>
              <span className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">{fmt(p.asRp)}</span>
            </li>
          ))}
          {chart.bullpen.length === 0 && <li className="text-gray-400">Empty.</li>}
        </ol>
      </div>
    </div>
  );
}

export function TeamsView() {
  const [state, setState] = useState(loadTeamsState);
  const [view, setView] = useState('list');
  const [newName, setNewName] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [scale, setScale] = useState('20-80');
  const [level, setLevel] = useState('mlb');
  const [feedback, setFeedback] = useState(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const fileRef = useRef(null);
  const timer = useRef(null);

  const update = (next) => {
    setState(next);
    saveTeamsState(next);
  };
  const flash = (msg) => {
    setFeedback(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 2500);
  };

  const team = state.teams.find((t) => t.id === state.activeId) ?? null;
  const chart = useMemo(() => (team ? buildDepthChart(team.players) : null), [team]);

  // Entries imported before the parser learned position ratings / WAR have
  // no defensive signal stored — the depth chart can't see what was never
  // captured. Re-importing the CSVs heals them via the field-level merge.
  const staleBatters = useMemo(() => {
    if (!team) return 0;
    return team.players.filter((p) => {
      if (p.type !== 'batter') return false;
      const pr = p.form.posRatings ?? {};
      const noPos = Object.values(pr).every((v) => !v?.ovr && !v?.pot);
      const noField = Object.values(p.form.fielding ?? {}).every((v) => !v);
      return noPos && noField;
    }).length;
  }, [team]);

  const addTeam = () => {
    const name = newName.trim() || `Team ${state.teams.length + 1}`;
    const t = newTeam(name);
    update({ teams: [...state.teams, t], activeId: t.id });
    setNewName('');
    setImportOpen(true);
  };

  const importCsv = (text) => {
    if (!team) return;
    const res = parsePlayersCsv(text, { scale, defaultLevel: level });
    if (res.errors.length > 0 || res.players.length === 0) {
      flash(res.errors[0] ?? 'No players found in that CSV.');
      return;
    }
    const players = mergeIntoRoster(team.players, res.players);
    update({
      ...state,
      teams: state.teams.map((t) => (t.id === team.id ? { ...t, players } : t)),
    });
    setCsvText('');
    flash(`Added/updated ${res.players.length} players — roster is now ${players.length}.`);
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importCsv(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const removePlayer = (i) => {
    update({
      ...state,
      teams: state.teams.map((t) =>
        t.id === team.id ? { ...t, players: t.players.filter((_, j) => j !== i) } : t
      ),
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Team picker / management */}
      <Section title="Teams" subtitle="Each team keeps its own roster — import a CSV per team and switch between them.">
        <div className="flex items-end gap-2 flex-wrap">
          {state.teams.length > 0 && (
            <label className="block w-48">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Team</span>
              <SelectInput
                value={state.activeId ?? ''}
                onChange={(id) => update({ ...state, activeId: id })}
                options={state.teams.map((t) => ({ id: t.id, label: `${t.name} (${t.players.length})` }))}
                ariaLabel="Team"
              />
            </label>
          )}
          <label className="block w-44">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">New team name</span>
            <div className="mt-1">
              <TextInput value={newName} onChange={setNewName} placeholder="e.g. Royals" ariaLabel="New team name" />
            </div>
          </label>
          <button onClick={addTeam} className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            + New team
          </button>
          {team && (
            <>
              <button
                onClick={() => setImportOpen((o) => !o)}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {importOpen ? 'Hide import' : 'Import roster CSV'}
              </button>
              <button
                onClick={() => update({ ...state, teams: state.teams.filter((t) => t.id !== team.id), activeId: state.teams.find((t) => t.id !== team.id)?.id ?? null })}
                className="px-3 py-2 text-sm rounded-lg text-red-500 hover:text-red-700"
              >
                Delete team
              </button>
            </>
          )}
        </div>

        {team && importOpen && (
          <div className="mt-3 space-y-2">
            <div className="flex items-end gap-2 flex-wrap">
              <label className="block w-36">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ratings scale</span>
                <SelectInput value={scale} onChange={setScale} options={RATING_SCALES} ariaLabel="CSV ratings scale" />
              </label>
              <label className="block w-40">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Default level</span>
                <SelectInput value={level} onChange={setLevel} options={LEAGUE_LEVELS} ariaLabel="Default level" />
              </label>
              <button onClick={() => fileRef.current?.click()} className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                Choose CSV file…
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" aria-label="Roster CSV file" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
              {csvText && (
                <button onClick={() => importCsv(csvText)} className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Add pasted CSV
                </button>
              )}
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="…or paste CSV text and hit “Add pasted CSV”. Import the hitting and pitching exports one after another — players merge by name."
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        {feedback && <p className="mt-2 text-xs text-green-600 dark:text-green-400">{feedback}</p>}
        {team && staleBatters > 0 && (
          <p className="mt-2 text-xs rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 px-3 py-2">
            {staleBatters} batter{staleBatters === 1 ? ' has' : 's have'} no position or fielding data stored —
            likely imported before the importer read those columns. Re-import your hitting CSV
            (and the pitching CSV for WAR/ERA+) to refresh them; players merge by name, nothing duplicates.
          </p>
        )}
      </Section>

      {!team ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">⚾</p>
          <p className="text-gray-500 dark:text-gray-400">Create a team and import its roster CSV to get a recommended depth chart.</p>
        </div>
      ) : (
        <>
          {/* Depth chart */}
          <Section
            title={`${team.name} — recommended depth chart`}
            subtitle={`${chart.batters.length} position players, ${chart.pitchers.length} pitchers. Starters are assigned best-fit-first; a player starts only one spot.`}
          >
            <div className="flex justify-end mb-2">
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                {[['list', 'List'], ['diamond', 'Diamond']].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setView(id)}
                    className={`px-3 py-1 ${view === id ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {view === 'diamond' ? <DiamondView chart={chart} /> : <ListView chart={chart} />}
            {view === 'diamond' && (
              <p className="text-center text-xs text-gray-400 mt-1">
                DH: <span className="text-gray-600 dark:text-gray-300 font-medium">{chart.dh ? `${chart.dh.b.name} (${Math.round(chart.dh.score)})` : '—'}</span>
                {chart.bullpen[0] && (
                  <> · CL: <span className="text-gray-600 dark:text-gray-300 font-medium">{chart.bullpen[0].name} ({fmt(chart.bullpen[0].asRp)})</span></>
                )}
              </p>
            )}
          </Section>

          {/* Upgrades */}
          <Section title="Upgrade recommendations" subtitle="Weak starters, thin depth, and staff holes — most urgent first.">
            {chart.upgrades.length === 0 ? (
              <p className="text-sm text-green-600 dark:text-green-400">No glaring holes — this roster is solid across the board.</p>
            ) : (
              <ul className="space-y-1.5">
                {chart.upgrades.map((u, i) => (
                  <li key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${SEV_STYLE[u.severity]}`}>
                    <span className="font-bold w-8 shrink-0">{u.area}</span>
                    <span>{u.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Roster management */}
          <Section title={`Roster (${team.players.length})`}>
            <button onClick={() => setRosterOpen((o) => !o)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              {rosterOpen ? 'Hide players' : 'Show players'}
            </button>
            {rosterOpen && (
              <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                {team.players.map((p, i) => (
                  <li key={`${p.type}-${p.summary.name}-${i}`} className="py-1.5 flex items-center gap-3 text-sm">
                    <span className="w-4 text-xs font-bold text-gray-400">{p.type === 'pitcher' ? 'P' : 'B'}</span>
                    <span className="flex-1 text-gray-900 dark:text-gray-100">{p.summary.name}</span>
                    <span className="text-xs text-gray-400">{p.summary.detail} · OVR {p.summary.ovr ?? '—'}</span>
                    <button onClick={() => removePlayer(i)} aria-label={`Remove ${p.summary.name} from roster`} className="text-gray-300 dark:text-gray-600 hover:text-red-500 px-1">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
