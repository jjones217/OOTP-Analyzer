import { useEffect, useMemo, useState } from 'react';
import { RATING_SCALES, fmt } from '../../lib/evaluation';
import {
  LEAGUE_LEVELS,
  INJURY_PRONE,
  playerTradeValue,
  sideTotal,
  tradeVerdict,
  defaultControlYears,
} from '../../lib/tradeValue';
import { NumInput, TextInput, SelectInput, Section } from './../player/formControls';
import {
  EMPTY_PLAYER,
  loadTradeState,
  saveTradeState,
  emptyTradeState,
} from '../../lib/tradeStore';

const VERDICT_TONES = {
  muted: 'text-gray-400',
  fair: 'text-green-600 dark:text-green-400',
  slight: 'text-amber-600 dark:text-amber-400',
  clear: 'text-red-600 dark:text-red-400',
};

function PlayerRow({ player, scale, onChange, onBench, onDelete }) {
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
          onClick={onBench}
          aria-label={`Remove ${player.name || 'player'} from trade`}
          title="Remove from trade (kept below for easy re-add)"
          className="shrink-0 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-200 dark:border-gray-700 rounded px-2 py-1"
        >
          Remove
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${player.name || 'player'} completely`}
          title="Delete completely"
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
          Effective grade <span className="font-semibold tabular-nums text-gray-500 dark:text-gray-300">{fmt(grade)}</span>
          {' · '}projects <span className="font-semibold tabular-nums text-gray-500 dark:text-gray-300">{annualWar}</span> WAR/yr
        </p>
      )}
    </div>
  );
}

function TradeSide({ side, scale, onChange, onBench }) {
  const setPlayer = (i, p) => {
    const players = side.players.slice();
    players[i] = p;
    onChange({ ...side, players });
  };
  const deletePlayer = (i) =>
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
          onBench={() => onBench(i)}
          onDelete={() => deletePlayer(i)}
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
  const [form, setForm] = useState(loadTradeState);

  useEffect(() => {
    saveTradeState(form);
  }, [form]);

  // Remove from the trade but keep on the bench for easy re-add.
  const benchPlayer = (sideKey, i) =>
    setForm((f) => {
      const side = f[sideKey];
      const player = side.players[i];
      return {
        ...f,
        [sideKey]: { ...side, players: side.players.filter((_, j) => j !== i) },
        bench: [...f.bench, { ...player, side: sideKey }],
      };
    });

  const reAddPlayer = (i) =>
    setForm((f) => {
      const { side = 'sideA', ...player } = f.bench[i];
      const target = f[side];
      return {
        ...f,
        [side]: { ...target, players: [...target.players, player] },
        bench: f.bench.filter((_, j) => j !== i),
      };
    });

  const deleteBenched = (i) =>
    setForm((f) => ({ ...f, bench: f.bench.filter((_, j) => j !== i) }));

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
          <TradeSide side={form.sideA} scale={form.scale} onChange={(s) => setForm((f) => ({ ...f, sideA: s }))} onBench={(i) => benchPlayer('sideA', i)} />
        </Section>
        <Section title={`${form.sideB.label} — ${totalB} pts`}>
          <TradeSide side={form.sideB} scale={form.scale} onChange={(s) => setForm((f) => ({ ...f, sideB: s }))} onBench={(i) => benchPlayer('sideB', i)} />
        </Section>
      </div>

      {/* Bench — removed players, one click to put back */}
      {form.bench.length > 0 && (
        <Section
          title="Removed from trade"
          subtitle="Kept here so they're easy to re-add. × deletes them for good."
        >
          <ul className="flex flex-wrap gap-2">
            {form.bench.map((p, i) => {
              const { value } = playerTradeValue(p, form.scale);
              return (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 pl-3 pr-1 py-1.5 text-sm"
                >
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {p.name || 'Unnamed'}
                  </span>
                  <span className="text-xs tabular-nums text-gray-400">
                    {value === null ? '—' : `${value} pts`}
                  </span>
                  <button
                    onClick={() => reAddPlayer(i)}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Re-add to {form[p.side ?? 'sideA']?.label ?? 'trade'}
                  </button>
                  <button
                    onClick={() => deleteBenched(i)}
                    aria-label={`Delete ${p.name || 'player'} from bench`}
                    className="text-gray-300 dark:text-gray-600 hover:text-red-500 text-base leading-none px-1"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <div className="text-center">
        <button onClick={() => setForm(emptyTradeState())} className="text-sm text-gray-400 hover:text-red-500">
          Clear trade
        </button>
      </div>
    </div>
  );
}
