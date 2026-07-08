import { useMemo, useRef, useState } from 'react';
import { RATING_SCALES, LEAGUE_LEVELS, fmt } from '../../lib/evaluation';
import { parsePlayersCsv } from '../../lib/csvImport';
import { savePlayer, loadIntoEvaluator } from '../../lib/savedPlayers';
import { addPlayerToTrade, tradeSideLabels } from '../../lib/tradeStore';
import { Section, SelectInput } from '../player/formControls';

const TYPE_BADGE = {
  batter: { label: 'B', className: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' },
  pitcher: { label: 'P', className: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' },
};

const SORTS = {
  ovr: (a, b) => (b.summary.ovr ?? -1) - (a.summary.ovr ?? -1),
  pot: (a, b) => (b.summary.pot ?? b.summary.ovr ?? -1) - (a.summary.pot ?? a.summary.ovr ?? -1),
  age: (a, b) => (Number(a.summary.age) || 99) - (Number(b.summary.age) || 99),
  name: (a, b) => a.summary.name.localeCompare(b.summary.name),
};

// onLoaded(type) — parent switches to that evaluator tab and remounts it.
export function CsvImport({ onLoaded }) {
  const [text, setText] = useState('');
  const [scale, setScale] = useState('20-80');
  const [defaultLevel, setDefaultLevel] = useState('mlb');
  const [result, setResult] = useState(null);
  const [sortBy, setSortBy] = useState('ovr');
  const [feedback, setFeedback] = useState(null);
  const labels = useMemo(() => tradeSideLabels(), []);
  const timer = useRef(null);
  const fileRef = useRef(null);

  const flash = (msg) => {
    setFeedback(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 2500);
  };

  const runParse = (csvText) => {
    setText(csvText);
    setResult(parsePlayersCsv(csvText, { scale, defaultLevel }));
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => runParse(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const players = useMemo(() => {
    if (!result) return [];
    return [...result.players].sort(SORTS[sortBy] ?? SORTS.ovr);
  }, [result, sortBy]);

  const saveAll = () => {
    for (const p of players) savePlayer(p);
    flash(`Saved ${players.length} player${players.length === 1 ? '' : 's'} — see the Saved tab.`);
  };

  const sortButton = (id, label) => (
    <button
      key={id}
      onClick={() => setSortBy(id)}
      className={`px-2 py-0.5 rounded ${sortBy === id ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <Section
        title="Import players from CSV"
        subtitle="Export a player list from OOTP or StatsPlus (with the ratings/stats columns you want), then drop the file here or paste the text. Columns are matched by header name; anything unrecognized is ignored."
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block col-span-2 sm:col-span-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ratings scale in the file</span>
              <SelectInput value={scale} onChange={setScale} options={RATING_SCALES} ariaLabel="CSV ratings scale" />
            </label>
            <label className="block col-span-2 sm:col-span-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Level (if no Lev column)</span>
              <SelectInput value={defaultLevel} onChange={setDefaultLevel} options={LEAGUE_LEVELS} ariaLabel="Default league level" />
            </label>
            <div className="col-span-2 flex items-end gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Choose CSV file…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                aria-label="CSV file"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {text && (
                <button
                  onClick={() => runParse(text)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Re-parse
                </button>
              )}
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => runParse(e.target.value)}
            placeholder={'…or paste CSV text here, e.g.\nName,POS,Age,CON,GAP,POW,EYE,K\'s,SPE\nBobby Whitfield,SS,24,60,55,50,55,55,65'}
            rows={4}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {result?.errors?.length > 0 && (
            <p className="text-sm text-red-600 dark:text-red-400">{result.errors.join(' ')}</p>
          )}
          {result && result.errors.length === 0 && (
            <p className="text-xs text-gray-400">
              Parsed <span className="font-semibold text-gray-600 dark:text-gray-300">{result.players.length}</span> players
              ({result.players.filter((p) => p.type === 'pitcher').length} pitchers).
              {result.unmapped.length > 0 && (
                <> Ignored columns: <span className="font-mono">{result.unmapped.join(', ')}</span></>
              )}
            </p>
          )}
        </div>
      </Section>

      {players.length > 0 && (
        <Section title={`Imported players (${players.length})`}>
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400 mr-1">Sort by</span>
              {sortButton('ovr', 'OVR')}
              {sortButton('pot', 'POT')}
              {sortButton('age', 'Age')}
              {sortButton('name', 'Name')}
            </div>
            <button
              onClick={saveAll}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Save all to list
            </button>
          </div>
          {feedback && <p className="mb-2 text-xs text-green-600 dark:text-green-400">{feedback}</p>}
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {players.map((entry, i) => {
              const s = entry.summary;
              const badge = TYPE_BADGE[entry.type];
              return (
                <li key={`${s.name}-${i}`} className="py-2.5 flex items-center gap-3 flex-wrap">
                  <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${badge.className}`}>
                    {badge.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{s.name}</div>
                    <div className="text-xs text-gray-400">
                      {s.detail}
                      {s.age && ` · ${s.age} yrs`}
                      {' · '}
                      {LEAGUE_LEVELS.find((l) => l.id === s.level)?.label ?? s.level}
                      {s.war && ` · ${s.war} WAR`}
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-24">
                    <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt(s.ovr)}</span>
                    {s.pot !== null && s.pot !== undefined && (
                      <span className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400"> / {fmt(s.pot)}</span>
                    )}
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 -mt-0.5">ovr / pot</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { loadIntoEvaluator(entry); onLoaded(entry.type); }}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => { savePlayer(entry); flash(`Saved ${s.name}.`); }}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Save
                    </button>
                    {[['sideA', labels.sideA], ['sideB', labels.sideB]].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => {
                          addPlayerToTrade(
                            {
                              name: s.name,
                              ovr: s.ovr === null || s.ovr === undefined ? '' : String(s.ovr),
                              pot: s.pot === null || s.pot === undefined ? '' : String(s.pot),
                              age: s.age ?? '',
                              level: s.level ?? 'mlb',
                              controlYears: '',
                              salary: '',
                              injury: 'normal',
                              scale: '20-80',
                            },
                            key
                          );
                          flash(`Added ${s.name} to “${label}”.`);
                        }}
                        title={`Add to “${label}”`}
                        className="px-2 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                      >
                        + {label}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
