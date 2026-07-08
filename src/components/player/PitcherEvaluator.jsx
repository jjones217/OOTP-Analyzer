import { useEffect, useMemo, useState } from 'react';
import { RATING_SCALES, LEAGUE_LEVELS, fmt } from '../../lib/evaluation';
import {
  PITCHER_ROLES,
  PITCH_TYPES,
  PITCH_AXES,
  evaluatePitcher,
  pitcherGradeLabel,
} from '../../lib/pitchingEvaluation';
import { RadarChart } from './RadarChart';
import { NumInput, TextInput, SelectInput, Section } from './formControls';
import { AddToTrade } from './AddToTrade';
import { savePlayer } from '../../lib/savedPlayers';

const STORAGE_KEY = 'ootp-pitcher-eval';

const EMPTY = {
  scale: '20-80',
  info: { name: '', role: 'sp', age: '', level: 'mlb' },
  stats: { ip: '', g: '', gs: '', k: '', bb: '', hr: '', era: '', eraPlus: '', fip: '', fipMinus: '', whip: '', war: '' },
  ratings: {
    stuff: '', stuffPot: '', movement: '', movementPot: '', hra: '', hraPot: '',
    pbabip: '', pbabipPot: '', control: '', controlPot: '',
  },
  pitches: Object.fromEntries(PITCH_TYPES.flatMap(({ key }) => [[key, ''], [`${key}Pot`, '']])),
  other: { velocity: '', gbPct: '', stamina: '', hold: '' },
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const saved = JSON.parse(raw);
    return {
      ...EMPTY,
      ...saved,
      info: { ...EMPTY.info, ...saved.info },
      stats: { ...EMPTY.stats, ...saved.stats },
      ratings: { ...EMPTY.ratings, ...saved.ratings },
      pitches: { ...EMPTY.pitches, ...saved.pitches },
      other: { ...EMPTY.other, ...saved.other },
    };
  } catch {
    return EMPTY;
  }
}

const STAT_FIELDS = [
  { key: 'ip', label: 'IP', step: 0.1 },
  { key: 'g', label: 'G' },
  { key: 'gs', label: 'GS' },
  { key: 'k', label: 'K' },
  { key: 'bb', label: 'BB' },
  { key: 'hr', label: 'HR' },
  { key: 'era', label: 'ERA', step: 0.01, hint: '3.85' },
  { key: 'eraPlus', label: 'ERA+', hint: '100' },
  { key: 'fip', label: 'FIP', step: 0.01, hint: '4.10' },
  { key: 'fipMinus', label: 'FIP−', hint: '100' },
  { key: 'whip', label: 'WHIP', step: 0.01, hint: '1.25' },
  { key: 'war', label: 'WAR', step: 0.1, hint: '2.0' },
];

const RATING_FIELDS = [
  { key: 'stuff', potKey: 'stuffPot', label: 'Stuff' },
  { key: 'movement', potKey: 'movementPot', label: 'Movement' },
  { key: 'hra', potKey: 'hraPot', label: 'HRA' },
  { key: 'pbabip', potKey: 'pbabipPot', label: 'pBABIP' },
  { key: 'control', potKey: 'controlPot', label: 'Control' },
];

export function PitcherEvaluator() {
  const [form, setForm] = useState(loadSaved);
  const [radarMode, setRadarMode] = useState('both');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch { /* storage full/blocked — evaluation still works */ }
  }, [form]);

  const set = (group, key, value) =>
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));

  const result = useMemo(() => evaluatePitcher(form), [form]);
  const { tools, ability, blended, overall, potTools, potOverall, results } = result;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ---- Input side ---- */}
      <div className="lg:col-span-3 space-y-4">
        <Section title="Pitcher">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="col-span-2 block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Name</span>
              <div className="mt-1">
                <TextInput value={form.info.name} onChange={(v) => set('info', 'name', v)} placeholder="Pitcher name" ariaLabel="Name" />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Role</span>
              <SelectInput value={form.info.role} onChange={(v) => set('info', 'role', v)} options={PITCHER_ROLES} ariaLabel="Role" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Age</span>
              <div className="mt-1">
                <NumInput value={form.info.age} onChange={(v) => set('info', 'age', v)} ariaLabel="Age" />
              </div>
            </label>
            <label className="col-span-2 block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">League level</span>
              <SelectInput value={form.info.level} onChange={(v) => set('info', 'level', v)} options={LEAGUE_LEVELS} ariaLabel="League level" />
            </label>
            <label className="col-span-2 block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Ratings scale</span>
              <SelectInput
                value={form.scale}
                onChange={(v) => setForm((f) => ({ ...f, scale: v }))}
                options={RATING_SCALES}
                ariaLabel="Ratings scale"
              />
            </label>
          </div>
        </Section>

        <Section title="Stats" subtitle="Season pitching line — stats from lower levels are translated to MLB-equivalent grades.">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {STAT_FIELDS.map(({ key, label, step, hint }) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                <div className="mt-1">
                  <NumInput value={form.stats[key]} onChange={(v) => set('stats', key, v)} step={step} placeholder={hint} ariaLabel={label} />
                </div>
              </label>
            ))}
          </div>
        </Section>

        <Section title="Pitching Ratings" subtitle={`Current / potential, on the ${form.scale} scale.`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {RATING_FIELDS.map(({ key, potKey, label }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                <NumInput value={form.ratings[key]} onChange={(v) => set('ratings', key, v)} placeholder="Cur" ariaLabel={`${label} current`} />
                <NumInput value={form.ratings[potKey]} onChange={(v) => set('ratings', potKey, v)} placeholder="Pot" ariaLabel={`${label} potential`} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Pitches" subtitle="Current / potential for each pitch the pitcher throws. Starters are graded on their top three, relievers on their top two.">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {PITCH_TYPES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                <NumInput value={form.pitches[key]} onChange={(v) => set('pitches', key, v)} placeholder="Cur" ariaLabel={`${label} current`} />
                <NumInput value={form.pitches[`${key}Pot`]} onChange={(v) => set('pitches', `${key}Pot`, v)} placeholder="Pot" ariaLabel={`${label} potential`} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Other" subtitle="Velocity sharpens the Stuff grade; GB% feeds Movement. Hold is recorded but not weighted.">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Velocity</span>
              <div className="mt-1">
                <TextInput value={form.other.velocity} onChange={(v) => set('other', 'velocity', v)} placeholder="95-97" ariaLabel="Velocity" />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">GB%</span>
              <div className="mt-1">
                <NumInput value={form.other.gbPct} onChange={(v) => set('other', 'gbPct', v)} placeholder="47" ariaLabel="Ground ball percent" />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Stamina</span>
              <div className="mt-1">
                <NumInput value={form.other.stamina} onChange={(v) => set('other', 'stamina', v)} ariaLabel="Stamina" />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Hold</span>
              <div className="mt-1">
                <NumInput value={form.other.hold} onChange={(v) => set('other', 'hold', v)} ariaLabel="Hold" />
              </div>
            </label>
          </div>
        </Section>

        <button onClick={() => setForm(EMPTY)} className="text-sm text-gray-400 hover:text-red-500">
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
                  {form.info.name || 'Unnamed Pitcher'}
                </h2>
                <p className="text-xs text-gray-400">
                  {PITCHER_ROLES.find((r) => r.id === form.info.role)?.label}
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
            <p className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">
              {pitcherGradeLabel(overall, form.info.role)}
            </p>
            {results !== null && (
              <p className="mt-2 text-xs text-gray-400">
                Run prevention (ERA/FIP/WHIP): <span className="font-semibold tabular-nums text-gray-600 dark:text-gray-300">{fmt(results)}</span> — folded into the OVR at 15%.
              </p>
            )}

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
                  type: 'pitcher',
                  form,
                  summary: {
                    name: form.info.name,
                    detail: PITCHER_ROLES.find((r) => r.id === form.info.role)?.label ?? 'SP',
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
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pitching Radar</h3>
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
            <RadarChart tools={tools} ability={ability} mode={radarMode} axes={PITCH_AXES} />

            {/* Grades table (accessible fallback for the chart) */}
            <table className="w-full mt-3 text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="text-left font-semibold py-1">Axis</th>
                  <th className="text-right font-semibold py-1">Tools</th>
                  <th className="text-right font-semibold py-1">Ability</th>
                  <th className="text-right font-semibold py-1">Blended</th>
                  {potTools && <th className="text-right font-semibold py-1">Pot</th>}
                </tr>
              </thead>
              <tbody>
                {PITCH_AXES.map(({ key, label }) => (
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
              Tools come from scouting ratings (Stuff includes velocity; Movement blends Mov,
              HRA, pBABIP, and GB%). Ability comes from the stat line: K/9 → Stuff, BB/9 &amp;
              WHIP → Control, HR/9 → Movement, IP per start → Stamina. Arsenal always uses
              pitch ratings. POT is the scouting ceiling from potential ratings only.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
