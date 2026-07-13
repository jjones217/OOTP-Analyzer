import { useMemo, useRef, useState } from 'react';
import { RATING_SCALES, LEAGUE_LEVELS, fmt } from '../../lib/evaluation';
import { parsePlayersCsv } from '../../lib/csvImport';
import { loadDraftBoard, saveDraftBoard, draftScore, engineRanks } from '../../lib/draftBoard';
import { savePlayer, loadIntoEvaluator } from '../../lib/savedPlayers';
import { Section, SelectInput } from '../player/formControls';

const TYPE_BADGE = {
  batter: { label: 'B', className: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' },
  pitcher: { label: 'P', className: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' },
};

// onLoaded(type) — parent switches to that evaluator tab and remounts it.
export function DraftBoard({ onLoaded }) {
  const [board, setBoard] = useState(loadDraftBoard);
  const [text, setText] = useState('');
  const [scale, setScale] = useState('20-80');
  const [level, setLevel] = useState('rookie');
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const fileRef = useRef(null);
  const timer = useRef(null);

  const persist = (entries) => {
    const next = { entries };
    setBoard(next);
    saveDraftBoard(next);
  };
  const flash = (msg) => {
    setFeedback(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(null), 2500);
  };

  const ranks = useMemo(() => engineRanks(board.entries), [board]);

  const importClass = (csvText) => {
    const res = parsePlayersCsv(csvText, { scale, defaultLevel: level });
    if (res.errors.length > 0 || res.players.length === 0) {
      setError(res.errors[0] ?? 'No players found in that CSV.');
      return;
    }
    setError(null);
    const entries = res.players
      .map((p, i) => ({ ...p, id: `${p.type}-${p.summary.name}-${i}` }))
      .sort((a, z) => (draftScore(z.summary) ?? -1) - (draftScore(a.summary) ?? -1));
    persist(entries);
    setText('');
    flash(`Loaded ${entries.length} prospects, ranked by draft score — drag (or use the arrows) to set your own order.`);
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importClass(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const move = (from, to) => {
    if (to < 0 || to >= board.entries.length || from === to) return;
    const entries = [...board.entries];
    const [e] = entries.splice(from, 1);
    entries.splice(to, 0, e);
    persist(entries);
  };

  const resetToEngine = () => {
    persist(
      [...board.entries].sort(
        (a, z) => (draftScore(z.summary) ?? -1) - (draftScore(a.summary) ?? -1)
      )
    );
    flash('Board reset to the engine order.');
  };

  const removeEntry = (i) => persist(board.entries.filter((_, j) => j !== i));

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Section
        title="Draft board"
        subtitle="Import your draft class CSV — every prospect is graded by the batter or pitcher engine, then ranked by draft score: 35% current, 65% potential, plus a youth bonus. Reorder the board by dragging or with the arrows; your order is saved."
      >
        <div className="flex items-end gap-2 flex-wrap">
          <label className="block w-36">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ratings scale</span>
            <SelectInput value={scale} onChange={setScale} options={RATING_SCALES} ariaLabel="Draft CSV ratings scale" />
          </label>
          <label className="block w-44">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Level (if no Lev column)</span>
            <SelectInput value={level} onChange={setLevel} options={LEAGUE_LEVELS} ariaLabel="Draft default level" />
          </label>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Load draft class CSV…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            aria-label="Draft class CSV file"
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          {board.entries.length > 0 && (
            <>
              <button onClick={resetToEngine} className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                Reset to engine order
              </button>
              <button onClick={() => persist([])} className="px-3 py-2 text-sm rounded-lg text-red-500 hover:text-red-700">
                Clear board
              </button>
            </>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text.trim() && importClass(text)}
          placeholder="…or paste the draft class CSV here (loads when you click away)"
          rows={3}
          className="mt-3 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {feedback && <p className="mt-1 text-xs text-green-600 dark:text-green-400">{feedback}</p>}
      </Section>

      {board.entries.length > 0 && (
        <Section
          title={`Your board (${board.entries.length})`}
          subtitle="Δ shows how far your slot differs from the engine's rank for that prospect."
        >
          <ol>
            {board.entries.map((entry, i) => {
              const s = entry.summary;
              const badge = TYPE_BADGE[entry.type] ?? TYPE_BADGE.batter;
              const score = draftScore(s);
              const eng = ranks.get(entry.id);
              const delta = eng === undefined ? 0 : eng - (i + 1);
              return (
                <li
                  key={entry.id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragIdx === null || dragIdx === i) return;
                    move(dragIdx, i);
                    setDragIdx(i);
                  }}
                  onDragEnd={() => setDragIdx(null)}
                  className={`flex items-center gap-2.5 py-2 border-t border-gray-100 dark:border-gray-800 first:border-t-0 ${
                    dragIdx === i ? 'opacity-50 bg-blue-50 dark:bg-blue-950' : ''
                  }`}
                >
                  <span className="cursor-grab text-gray-300 dark:text-gray-600 select-none" title="Drag to reorder" aria-hidden>⠿</span>
                  <span className="w-8 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">{i + 1}</span>
                  <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${badge.className}`}>
                    {badge.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{s.name}</div>
                    <div className="text-xs text-gray-400">
                      {s.detail}
                      {s.age && ` · ${s.age} yrs`}
                      {s.war && ` · ${s.war} WAR`}
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <span className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmt(s.ovr)}</span>
                    <span className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400"> / {fmt(s.pot ?? s.ovr)}</span>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 -mt-0.5">ovr / pot</div>
                  </div>
                  <div className="text-right shrink-0 w-14">
                    <span className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">{score === null ? '—' : score.toFixed(1)}</span>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 -mt-0.5">score</div>
                  </div>
                  <span
                    className={`w-10 text-center text-xs font-semibold tabular-nums ${
                      delta > 0 ? 'text-green-600 dark:text-green-400' : delta < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-300 dark:text-gray-600'
                    }`}
                    title={delta === 0 ? 'Matches the engine rank' : `Engine ranks this prospect #${eng}`}
                  >
                    {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '—'}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => move(i, i - 1)} aria-label={`Move ${s.name} up`} className="px-1.5 py-0.5 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">▲</button>
                    <button onClick={() => move(i, i + 1)} aria-label={`Move ${s.name} down`} className="px-1.5 py-0.5 text-xs rounded border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">▼</button>
                    <button
                      onClick={() => { loadIntoEvaluator(entry); onLoaded(entry.type); }}
                      className="px-2 py-0.5 text-xs font-medium rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => { savePlayer(entry); flash(`Saved ${s.name}.`); }}
                      className="px-2 py-0.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button onClick={() => removeEntry(i)} aria-label={`Remove ${s.name} from board`} className="text-gray-300 dark:text-gray-600 hover:text-red-500 px-1">×</button>
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      )}
    </div>
  );
}
