import { useEffect, useMemo, useState } from 'react';
import { RATING_SCALES } from '../../lib/evaluation';
import {
  LEAGUE_LEVELS,
  INJURY_PRONE,
  playerTradeValue,
  sideTotal,
  tradeVerdict,
  defaultControlYears,
} from '../../lib/tradeValue';
import { NumInput, TextInput, SelectInput, Section } from './../player/formControls';

const STORAGE_KEY = 'ootp-trade-analyzer';

const EMPTY_PLAYER = {
  name: '', ovr: '', pot: '', age: '', level: 'mlb', controlYears: '', salary: '', injury: 'normal',
};

const EMPTY = {
  scale: '20-80',
  sideA: { label: 'You receive', players: [{ ...EMPTY_PLAYER }] },
  sideB: { label: 'You give up', players: [{ ...EMPTY_PLAYER }] },
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const saved = JSON.parse(raw);
    return {
      ...EMPTY,
      ...saved,
      sideA: { ...EMPTY.sideA, ...saved.sideA },
      sideB: { ...EMPTY.sideB, ...saved.sideB },
    };
  } catch {
    return EMPTY;
  }
}

const VERDICT_TONES = {
  muted: 'text-gray-400',
  fair: 'text-green-600 dark:text-green-400',
  slight: 'text-amber-600 dark:text-amber-400',
  clear: 'text-red-600 dark:text-red-400',
};

function PlayerRow({ player, scale, onChange, onRemove }) {
  const { value, grade, annualWar } = playerTradeValue(player, scale);
  const set = (key, v) => onChange({ ...player, [key]: v });

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TextInput value={player.name} onChange={(v) => set('name', v)} placeholder="Player name" ariaLabel="Player name" />
        </div>
        <div className="text-right shrink-0 w-20">
          <div className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {value === null ? '—' : value}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-gray-400 -mt-0.5">value</div>
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove player"
          className="shrink-0 text-gray-300 dark:text-gray-600 hover:text-red-500 text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">OVR</span>
          <NumInput value={player.ovr} onChange={(v) => set('ovr', v)} ariaLabel={`${player.name || 'player'} OVR`} />
        </label>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">POT</span>
          <NumInput value={player.pot} onChange={(v) => set('pot', v)} ariaLabel={`${player.name || 'player'} POT`} />
        </label>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Age</span>
          <NumInput value={player.age} onChange={(v) => set('age', v)} ariaLabel={`${player.name || 'player'} age`} />
        </label>
        <label className="block col-span-2 sm:col-span-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Level</span>
          <div className="-mt-1">
            <SelectInput value={player.level} onChange={(v) => set('level', v)} options={LEAGUE_LEVELS} ariaLabel={`${player.name || 'player'} level`} />
          </div>
        </label>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Ctrl yrs</span>
          <NumInput value={player.controlYears} onChange={(v) => set('controlYears', v)} placeholder={String(defaultControlYears(player.level))} ariaLabel={`${player.name || 'player'} control years`} />
        </label>
        <label className="block">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">$M/yr</span>
          <NumInput value={player.salary} onChange={(v) => set('salary', v)} step={0.1} ariaLabel={`${player.name || 'player'} salary`} />
        </label>
        <label className="block col-span-2 sm:col-span-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Inj Prone</span>
          <div className="-mt-1">
            <SelectInput value={player.injury} onChange={(v) => set('injury', v)} options={INJURY_PRONE} ariaLabel={`${player.name || 'player'} injury proneness`} />
          </div>
        </label>
      </div>
      {value !== null && (
        <p className="text-[11px] text-gray-400">
          Effective grade <span className="font-semibold tabular-nums text-gray-500 dark:text-gray-300">{grade}</span>
          {' · '}projects <span className="font-semibold tabular-nums text-gray-500 dark:text-gray-300">{annualWar}</span> WAR/yr
        </p>
      )}
    </div>
  );
}

function TradeSide({ side, scale, onChange }) {
  const setPlayer = (i, p) => {
    const players = side.players.slice();
    players[i] = p;
    onChange({ ...side, players });
  };
  const removePlayer = (i) =>
    onChange({ ...side, players: side.players.filter((_, j) => j !== i) });
  const addPlayer = () =>
    onChange({ ...side, players: [...side.players, { ...EMPTY_PLAYER }] });

  return (
    <div className="space-y-3">
      <TextInput value={side.label} onChange={(v) => onChange({ ...side, label: v })} ariaLabel="Side label" />
      {side.players.map((p, i) => (
        <PlayerRow
          key={i}
          player={p}
          scale={scale}
          onChange={(np) => setPlayer(i, np)}
          onRemove={() => removePlayer(i)}
        />
      ))}
      <button
        onClick={addPlayer}
        className="w-full py-2 text-sm text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg"
      >
        + Add player
      </button>
    </div>
  );
}

export function TradeAnalyzer() {
  const [form, setForm] = useState(loadSaved);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch { /* storage full/blocked — analysis still works */ }
  }, [form]);

  const totalA = useMemo(() => sideTotal(form.sideA.players, form.scale), [form]);
  const totalB = useMemo(() => sideTotal(form.sideB.players, form.scale), [form]);
  const verdict = tradeVerdict(totalA, totalB, form.sideA.label, form.sideB.label);
  const maxTotal = Math.max(totalA, totalB, 1);

  return (
    <div className="space-y-6">
      {/* Verdict card */}
      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Trade Verdict</h2>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            Ratings scale
            <select
              value={form.scale}
              onChange={(e) => setForm((f) => ({ ...f, scale: e.target.value }))}
              className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RATING_SCALES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        {/* side value bars */}
        <div className="space-y-2">
          {[[form.sideA.label, totalA, 'var(--series-tools)'], [form.sideB.label, totalB, 'var(--series-ability)']].map(([label, total, color]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-gray-600 dark:text-gray-300 truncate">{label}</span>
              <div className="flex-1 h-5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-r"
                  style={{ width: `${(total / maxTotal) * 100}%`, background: color }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{total}</span>
            </div>
          ))}
        </div>
        <p className={`mt-3 text-sm font-medium ${VERDICT_TONES[verdict.tone]}`}>{verdict.text}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
          Value = projected WAR over the years of control, discounted for time, aging, prospect
          risk (level &amp; age), durability, and salary (at $8M/WAR when entered). Ctrl yrs
          defaults to 3 for MLB players and 6 for prospects. Enter OVR/POT as scouting grades —
          the boom-or-bust math already prices in the chance a prospect never gets there.
        </p>
      </section>

      {/* Two sides */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`${form.sideA.label} — ${totalA} pts`}>
          <TradeSide side={form.sideA} scale={form.scale} onChange={(s) => setForm((f) => ({ ...f, sideA: s }))} />
        </Section>
        <Section title={`${form.sideB.label} — ${totalB} pts`}>
          <TradeSide side={form.sideB} scale={form.scale} onChange={(s) => setForm((f) => ({ ...f, sideB: s }))} />
        </Section>
      </div>

      <div className="text-center">
        <button onClick={() => setForm(EMPTY)} className="text-sm text-gray-400 hover:text-red-500">
          Clear trade
        </button>
      </div>
    </div>
  );
}
