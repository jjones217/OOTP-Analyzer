import { useEffect, useMemo, useState } from 'react';
import {
  RATING_SCALES,
  LEAGUE_LEVELS,
  POSITIONS,
  FIELD_POSITIONS,
  TOOL_AXES,
  evaluatePlayer,
  gradeLabel,
  fmt,
} from '../../lib/evaluation';
import { RadarChart } from './RadarChart';
import { NumInput, Section } from './formControls';
import { AddToTrade } from './AddToTrade';
import { savePlayer } from '../../lib/savedPlayers';

const STORAGE_KEY = 'ootp-player-eval';

const EMPTY = {
  scale: '20-80',
  info: { name: '', position: 'SS', age: '', level: 'mlb' },
  stats: { pa: '', hits: '', doubles: '', triples: '', hr: '', bb: '', k: '', avg: '', obp: '', slg: '', wrcPlus: '', sb: '', cs: '' },
  ratings: {
    contact: '', contactPot: '', babip: '', babipPot: '', avoidK: '', avoidKPot: '',
    gap: '', gapPot: '', power: '', powerPot: '', eye: '', eyePot: '',
    speed: '', stlAggr: '', stealing: '', baserunning: '', sacBunt: '', buntForHit: '',
  },
  fielding: { cArm: '', cBlk: '', cFrm: '', ifRng: '', ifErr: '', ifArm: '', ifDp: '', ofRng: '', ofErr: '', ofArm: '' },
  posRatings: Object.fromEntries(FIELD_POSITIONS.map((p) => [p, { ovr: '', pot: '' }])),
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const saved = JSON.parse(raw);
    // Older saves had a single "bunt" rating — carry it into Sac Bunt.
    if (saved.ratings?.bunt && !saved.ratings.sacBunt) {
      saved.ratings.sacBunt = saved.ratings.bunt;
    }
    // Merge over EMPTY so newly added fields don't come back undefined
    return {
      ...EMPTY,
      ...saved,
      info: { ...EMPTY.info, ...saved.info },
      stats: { ...EMPTY.stats, ...saved.stats },
      ratings: { ...EMPTY.ratings, ...saved.ratings },
      fielding: { ...EMPTY.fielding, ...saved.fielding },
      posRatings: { ...EMPTY.posRatings, ...saved.posRatings },
    };
  } catch {
    return EMPTY;
  }
}

const STAT_FIELDS = [
  { key: 'pa', label: 'PA' },
  { key: 'hits', label: 'Hits' },
  { key: 'doubles', label: '2B' },
  { key: 'triples', label: '3B' },
  { key: 'hr', label: 'HR' },
  { key: 'bb', label: 'BB' },
  { key: 'k', label: 'K' },
  { key: 'avg', label: 'AVG', step: 0.001, hint: '.285' },
  { key: 'obp', label: 'OBP', step: 0.001, hint: '.350' },
  { key: 'slg', label: 'SLG', step: 0.001, hint: '.450' },
  { key: 'wrcPlus', label: 'wRC+' },
  { key: 'sb', label: 'SB' },
  { key: 'cs', label: 'CS' },
];

// Batting ratings have current + potential in OOTP; running ratings don't.
const BATTING_FIELDS = [
  { key: 'contact', potKey: 'contactPot', label: 'Contact' },
  { key: 'babip', potKey: 'babipPot', label: 'BABIP' },
  { key: 'avoidK', potKey: 'avoidKPot', label: 'Avoid K' },
  { key: 'gap', potKey: 'gapPot', label: 'Gap' },
  { key: 'power', potKey: 'powerPot', label: 'Power' },
  { key: 'eye', potKey: 'eyePot', label: 'Eye' },
];

const RUNNING_FIELDS = [
  { key: 'speed', label: 'Speed' },
  { key: 'stlAggr', label: 'Stl Aggr' },
  { key: 'stealing', label: 'Stealing' },
  { key: 'baserunning', label: 'Running' },
  { key: 'sacBunt', label: 'Sac Bunt' },
  { key: 'buntForHit', label: 'Bunt for Hit' },
];

const FIELDING_GROUPS = [
  { title: 'Catcher', fields: [['cArm', 'Arm'], ['cBlk', 'Blocking'], ['cFrm', 'Framing']] },
  { title: 'Infield', fields: [['ifRng', 'Range'], ['ifErr', 'Error'], ['ifArm', 'Arm'], ['ifDp', 'Turn DP']] },
  { title: 'Outfield', fields: [['ofRng', 'Range'], ['ofErr', 'Error'], ['ofArm', 'Arm']] },
];

export function BatterEvaluator() {
  const [form, setForm] = useState(loadSaved);
  const [radarMode, setRadarMode] = useState('both');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch { /* storage full/blocked — evaluation still works */ }
  }, [form]);

  const set = (group, key, value) =>
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));
  const setPos = (pos, key, value) =>
    setForm((f) => ({
      ...f,
      posRatings: { ...f.posRatings, [pos]: { ...f.posRatings[pos], [key]: value } },
    }));

  const result = useMemo(() => evaluatePlayer(form), [form]);
  const { tools, ability, blended, overall, recPositions, potTools, potOverall, statWeight } = result;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ---- Input side ---- */}
      <div className="lg:col-span-3 space-y-4">
        <Section title="Player">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="col-span-2 block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Name</span>
              <input
                type="text"
                value={form.info.name}
                onChange={(e) => set('info', 'name', e.target.value)}
                placeholder="Player name"
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Position</span>
              <select
                value={form.info.position}
                onChange={(e) => set('info', 'position', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Age</span>
              <NumInput value={form.info.age} onChange={(v) => set('info', 'age', v)} ariaLabel="Age" />
            </label>
            <label className="col-span-2 block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">League level</span>
              <select
                value={form.info.level}
                onChange={(e) => set('info', 'level', e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LEAGUE_LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ratings scale</span>
              <select
                value={form.scale}
                onChange={(e) => setForm((f) => ({ ...f, scale: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {RATING_SCALES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>
        </Section>

        <Section title="Stats" subtitle="Season batting line — stats from lower levels are translated to MLB-equivalent grades. PA scales how much the sample counts: a cup of coffee barely moves the blend.">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {STAT_FIELDS.map(({ key, label, step, hint }) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                <div className="mt-1">
                  <NumInput
                    value={form.stats[key]}
                    onChange={(v) => set('stats', key, v)}
                    step={step}
                    placeholder={hint}
                    ariaLabel={label}
                  />
                </div>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Batting Ratings" subtitle={`Current / potential, on the ${form.scale} scale. Potential feeds the POT grade.`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {BATTING_FIELDS.map(({ key, potKey, label }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                <NumInput value={form.ratings[key]} onChange={(v) => set('ratings', key, v)} placeholder="Cur" ariaLabel={`${label} current`} />
                <NumInput value={form.ratings[potKey]} onChange={(v) => set('ratings', potKey, v)} placeholder="Pot" ariaLabel={`${label} potential`} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Run / Bunt Ratings" subtitle="Steal aggressiveness and bunting are recorded but not weighted into grades.">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {RUNNING_FIELDS.map(({ key, label }) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                <div className="mt-1">
                  <NumInput value={form.ratings[key]} onChange={(v) => set('ratings', key, v)} ariaLabel={label} />
                </div>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Fielding Ratings" subtitle="Fill only the groups the player actually plays.">
          <div className="grid gap-4 sm:grid-cols-3">
            {FIELDING_GROUPS.map(({ title, fields }) => (
              <div key={title}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{title}</h4>
                <div className="space-y-2">
                  {fields.map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                      <div className="w-20">
                        <NumInput value={form.fielding[key]} onChange={(v) => set('fielding', key, v)} ariaLabel={`${title} ${label}`} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Position Ratings" subtitle="In-game current / potential at each position (optional — sharpens the recommendation).">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
            {FIELD_POSITIONS.map((pos) => (
              <div key={pos} className="flex items-center gap-2">
                <span className="w-7 text-xs font-semibold text-gray-600 dark:text-gray-300">{pos}</span>
                <NumInput value={form.posRatings[pos].ovr} onChange={(v) => setPos(pos, 'ovr', v)} placeholder="Ovr" ariaLabel={`${pos} current`} />
                <NumInput value={form.posRatings[pos].pot} onChange={(v) => setPos(pos, 'pot', v)} placeholder="Pot" ariaLabel={`${pos} potential`} />
              </div>
            ))}
          </div>
        </Section>

        <button
          onClick={() => setForm(EMPTY)}
          className="text-sm text-gray-400 hover:text-red-500"
        >
          Clear all fields
        </button>
      </div>

      {/* ---- Results side ---- */}
      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-6 space-y-4">
          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {form.info.name || 'Unnamed Player'}
                </h2>
                <p className="text-xs text-gray-400">
                  {form.info.position}
                  {form.info.age && ` · ${form.info.age} yrs`}
                  {' · '}
                  {LEAGUE_LEVELS.find((l) => l.id === form.info.level)?.label}
                </p>
              </div>
              <div className="flex gap-4 shrink-0">
                <div className="text-center">
                  <div className="text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {overall ?? '—'}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">OVR (20–80)</div>
                </div>
                {potOverall !== null && (
                  <div className="text-center">
                    <div className="text-3xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                      {potOverall}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-400">POT</div>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">{gradeLabel(overall)}</p>

            {/* Recommended positions */}
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recommended positions</h3>
              {recPositions.length === 0 ? (
                <p className="text-xs text-gray-400 mt-1">Enter fielding or position ratings to get recommendations.</p>
              ) : (
                <ol className="mt-2 flex gap-2">
                  {recPositions.map(({ pos, fit, fitPot }, i) => (
                    <li
                      key={pos}
                      className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-center"
                    >
                      <div className="text-[10px] text-gray-400">#{i + 1}</div>
                      <div className="text-base font-bold text-gray-900 dark:text-gray-100">{pos}</div>
                      <div className="text-[10px] text-gray-400">
                        fit {fit}
                        {fitPot !== null && fitPot !== fit && (
                          <> · <span className="text-blue-600 dark:text-blue-400">pot {fitPot}</span></>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <AddToTrade
              player={{
                name: form.info.name,
                ovr: overall === null ? '' : String(overall),
                pot: potOverall === null ? '' : String(potOverall),
                age: form.info.age,
                level: form.info.level,
                controlYears: '',
                salary: '',
                injury: 'normal',
                scale: '20-80',
              }}
              disabled={overall === null}
              onSave={() =>
                savePlayer({
                  type: 'batter',
                  form,
                  summary: {
                    name: form.info.name,
                    detail: form.info.position,
                    age: form.info.age,
                    level: form.info.level,
                    ovr: overall,
                    pot: potOverall,
                  },
                })
              }
            />
          </section>

          <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tool Radar</h3>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
                {[['tools', 'Tools'], ['ability', 'Ability'], ['both', 'Both']].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setRadarMode(id)}
                    className={`px-2.5 py-1 ${
                      radarMode === id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <RadarChart tools={tools} ability={ability} mode={radarMode} />

            {/* Grades table (accessible fallback for the chart) */}
            <table className="w-full mt-3 text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="text-left font-semibold py-1">Tool</th>
                  <th className="text-right font-semibold py-1">Tools</th>
                  <th className="text-right font-semibold py-1">Ability</th>
                  <th className="text-right font-semibold py-1">Blended</th>
                  {potTools && <th className="text-right font-semibold py-1">Pot</th>}
                </tr>
              </thead>
              <tbody>
                {TOOL_AXES.map(({ key, label }) => (
                  <tr key={key} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1 text-gray-600 dark:text-gray-300">{label}</td>
                    <td className="py-1 text-right tabular-nums text-gray-900 dark:text-gray-100">{fmt(tools[key])}</td>
                    <td className="py-1 text-right tabular-nums text-gray-900 dark:text-gray-100">{fmt(ability[key])}</td>
                    <td className="py-1 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">{fmt(blended[key])}</td>
                    {potTools && (
                      <td className="py-1 text-right tabular-nums text-blue-600 dark:text-blue-400">{fmt(potTools[key])}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
              Tools come from scouting ratings; Ability from the stat line (league-adjusted,
              counting stats normalized per 600 PA).
              {ability.hasStats && statWeight > 0 && (
                <> Stats carry <span className="font-semibold">{Math.round(statWeight * 100)}%</span> of
                the blend{ability.pa !== null && statWeight < 0.5 ? ' (small sample)' : ''}.</>
              )}
              {' '}The OVR is weighted for the player's position. Field &amp; Arm always
              use ratings — no fielding stats on the card. POT is the scouting ceiling from
              potential ratings only.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
