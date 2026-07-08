// Pitcher evaluation engine — same philosophy as the batting module:
// everything normalized to 20-80, Tools from scouting ratings, Ability from
// the stat line (league-adjusted), blended for the overall grade.
import { LEAGUE_LEVELS, to2080, clamp, num, gradeFrom, wMean } from './evaluation.js';
import { getLeagueAdjusted } from './evalSettings.js';

export const PITCHER_ROLES = [
  { id: 'sp', label: 'SP' },
  { id: 'rp', label: 'RP' },
  { id: 'cl', label: 'CL' },
];

export const PITCH_TYPES = [
  { key: 'fastball', label: 'Fastball' },
  { key: 'sinker', label: 'Sinker' },
  { key: 'cutter', label: 'Cutter' },
  { key: 'slider', label: 'Slider' },
  { key: 'curveball', label: 'Curveball' },
  { key: 'changeup', label: 'Changeup' },
  { key: 'splitter', label: 'Splitter' },
  { key: 'forkball', label: 'Forkball' },
  { key: 'circlechange', label: 'Circle Change' },
  { key: 'screwball', label: 'Screwball' },
  { key: 'knucklecurve', label: 'Knuckle Curve' },
  { key: 'knuckleball', label: 'Knuckleball' },
];

export const PITCH_AXES = [
  { key: 'stuff', label: 'Stuff' },
  { key: 'movement', label: 'Movement' },
  { key: 'control', label: 'Control' },
  { key: 'arsenal', label: 'Arsenal' },
  { key: 'stamina', label: 'Stamina' },
];

// MLB-calibrated stat → grade anchors.
const K9_PTS = [[4, 28], [6, 40], [7, 45], [8, 50], [9, 55], [10, 62], [11, 68], [12.5, 76]];
const BB9_PTS = [[1.5, 75], [2.0, 68], [2.5, 60], [3.0, 52], [3.5, 46], [4.5, 36], [6.0, 25]];
const HR9_PTS = [[0.5, 70], [0.8, 60], [1.0, 53], [1.2, 48], [1.5, 40], [2.0, 30]];
const ERA_PTS = [[2.5, 75], [3.0, 66], [3.5, 58], [4.0, 50], [4.5, 44], [5.5, 33], [7.0, 22]];
const FIP_PTS = ERA_PTS;
const FIPM_PTS = [[70, 72], [80, 64], [90, 57], [100, 50], [110, 44], [125, 35], [140, 27]];
const ERAP_PTS = [[60, 25], [80, 40], [90, 45], [100, 50], [115, 58], [130, 65], [150, 72], [180, 80]];
const WHIP_PTS = [[1.00, 72], [1.10, 64], [1.20, 56], [1.30, 50], [1.40, 43], [1.60, 32]];
const IPGS_PTS = [[4.5, 40], [5.3, 48], [6.0, 56], [6.7, 64], [7.3, 72]];
const VELO_PTS = [[88, 30], [91, 40], [93, 48], [95, 55], [97, 63], [99, 72], [101, 80]];
const GBPCT_PTS = [[35, 40], [42, 46], [47, 50], [52, 56], [58, 63], [65, 70]];

// Parse a velocity entry like "95-97", "95-97 (Max)", or "96" → top mph.
export function parseVelocity(text) {
  if (!text) return null;
  const matches = String(text).match(/\d{2,3}(\.\d+)?/g);
  if (!matches) return null;
  return Math.max(...matches.map(Number));
}

// ---------------------------------------------------------------------------
// Tools — scouting ratings, normalized to 20-80.
// ---------------------------------------------------------------------------

// Arsenal quality: a starter lives off his top three pitches, a reliever off
// two — a missing pitch counts as a 20, so a two-pitch starter gets docked.
function arsenalGrade(pitchValues, role) {
  const entered = pitchValues.filter((v) => v !== null).sort((a, b) => b - a);
  if (entered.length === 0) return null;
  const need = role === 'sp' ? 3 : 2;
  const weights = role === 'sp' ? [0.45, 0.35, 0.2] : [0.6, 0.4];
  let sum = 0;
  for (let i = 0; i < need; i++) sum += (entered[i] ?? 20) * weights[i];
  return sum;
}

// r = normalized pitching ratings, extras = { veloTop, gbPct, stamina, pitches }
export function computePitchTools(r, extras, role, { potential = false } = {}) {
  const pick = (cur, pot) => (potential && pot != null ? pot : cur);

  const stuffRating = pick(r.stuff, r.stuffPot);
  const veloGrade = extras.veloTop !== null ? gradeFrom(extras.veloTop, VELO_PTS) : null;
  const stuff = wMean([[stuffRating, 0.75], [veloGrade, 0.25]]);

  const movCore = wMean([
    [pick(r.movement, r.movementPot), 0.5],
    [pick(r.hra, r.hraPot), 0.3],
    [pick(r.pbabip, r.pbabipPot), 0.2],
  ]);
  const gbGrade = extras.gbPct !== null ? gradeFrom(extras.gbPct, GBPCT_PTS) : null;
  const movement = wMean([[movCore, 0.85], [gbGrade, 0.15]]);

  const pitchVals = PITCH_TYPES.map(({ key }) =>
    potential && extras.pitches[`${key}Pot`] != null
      ? extras.pitches[`${key}Pot`]
      : extras.pitches[key] ?? null
  );

  return {
    stuff,
    movement,
    control: pick(r.control, r.controlPot),
    arsenal: arsenalGrade(pitchVals, role),
    stamina: extras.stamina,
  };
}

// ---------------------------------------------------------------------------
// Ability — what the stat line says, level-adjusted. Arsenal has no stats;
// stamina only gets one when the innings say something (regular starter).
// ---------------------------------------------------------------------------

export function computePitchAbility(stats, level, tools) {
  const offset = LEAGUE_LEVELS.find((l) => l.id === level)?.offset ?? 0;
  const adj = (g) => (g === null ? null : clamp(g + offset));

  // IP uses baseball notation: .1/.2 are thirds of an inning (115.2 = 115⅔).
  const ipRaw = num(stats.ip);
  let ip = ipRaw;
  if (ipRaw !== null) {
    const whole = Math.trunc(ipRaw);
    const frac = Math.round((ipRaw - whole) * 10);
    if (frac === 1) ip = whole + 1 / 3;
    else if (frac === 2) ip = whole + 2 / 3;
  }
  const g = num(stats.g);
  const gs = num(stats.gs);
  const k = num(stats.k);
  const bb = num(stats.bb);
  const hr = num(stats.hr);
  const era = num(stats.era);
  const fip = num(stats.fip);
  const fipMinus = num(stats.fipMinus);
  const eraPlus = num(stats.eraPlus);
  const whip = num(stats.whip);

  const per9 = (x) => (x !== null && ip !== null && ip > 0 ? (x * 9) / ip : null);

  const stuffStat = adj(gradeFrom(per9(k), K9_PTS));
  const controlStat = wMean([
    [adj(gradeFrom(per9(bb), BB9_PTS)), 0.7],
    [adj(gradeFrom(whip, WHIP_PTS)), 0.3],
  ]);
  const movementStat = adj(gradeFrom(per9(hr), HR9_PTS));

  // A regular starter's innings-per-start says something about stamina.
  const staminaStat =
    gs !== null && gs >= 5 && ip !== null ? adj(gradeFrom(ip / gs, IPGS_PTS)) : null;

  // Run-prevention results — FIP- and ERA+ are already league/park
  // adjusted, so no level offset on those. Feeds the OVR as a kicker, not
  // a radar axis. In league-adjusted mode the relative metrics dominate.
  const results = getLeagueAdjusted()
    ? wMean([
        [gradeFrom(fipMinus, FIPM_PTS), 0.45],
        [gradeFrom(eraPlus, ERAP_PTS), 0.3],
        [adj(gradeFrom(fip, FIP_PTS)), 0.1],
        [adj(gradeFrom(era, ERA_PTS)), 0.05],
        [adj(gradeFrom(whip, WHIP_PTS)), 0.1],
      ])
    : wMean([
        [gradeFrom(fipMinus, FIPM_PTS), 0.35],
        [gradeFrom(eraPlus, ERAP_PTS), 0.15],
        [adj(gradeFrom(fip, FIP_PTS)), 0.2],
        [adj(gradeFrom(era, ERA_PTS)), 0.1],
        [adj(gradeFrom(whip, WHIP_PTS)), 0.2],
      ]);

  return {
    stuff: stuffStat ?? tools.stuff,
    movement: movementStat ?? tools.movement,
    control: controlStat ?? tools.control,
    arsenal: tools.arsenal, // no arsenal stats on the card
    stamina: staminaStat ?? tools.stamina,
    results,
    hasStats: stuffStat !== null || controlStat !== null || movementStat !== null,
    usage: { g, gs },
  };
}

// ---------------------------------------------------------------------------
// Blend + overall.
// ---------------------------------------------------------------------------

export function blendPitch(tools, ability) {
  const blend = (t, a) => {
    if (t === null && a === null) return null;
    if (t === null) return a;
    if (a === null) return t;
    return t * 0.5 + a * 0.5;
  };
  return {
    stuff: blend(tools.stuff, ability.stuff),
    movement: blend(tools.movement, ability.movement),
    control: blend(tools.control, ability.control),
    arsenal: tools.arsenal,
    stamina: blend(tools.stamina, ability.stamina),
  };
}

// Starters need stamina and a deep arsenal; relievers live on stuff.
const ROLE_WEIGHTS = {
  sp: { stuff: 0.28, movement: 0.24, control: 0.24, arsenal: 0.11, stamina: 0.13 },
  rp: { stuff: 0.38, movement: 0.27, control: 0.25, arsenal: 0.08, stamina: 0.02 },
  cl: { stuff: 0.40, movement: 0.27, control: 0.25, arsenal: 0.06, stamina: 0.02 },
};

export function computePitchOverall(blended, role, results = null) {
  const w = ROLE_WEIGHTS[role] ?? ROLE_WEIGHTS.sp;
  const axes = wMean([
    [blended.stuff, w.stuff],
    [blended.movement, w.movement],
    [blended.control, w.control],
    [blended.arsenal, w.arsenal],
    [blended.stamina, w.stamina],
  ]);
  if (axes === null) return null;
  // Actual run prevention (ERA/FIP/WHIP) refines the component view — and
  // carries more weight in league-adjusted mode, where the component
  // stats (K/9, HR/9) are themselves environment-colored.
  const kicker = getLeagueAdjusted() ? 0.3 : 0.15;
  const ovr = results !== null ? axes * (1 - kicker) + results * kicker : axes;
  return Math.round(clamp(ovr));
}

export function pitcherGradeLabel(ovr, role) {
  if (ovr === null) return '—';
  if (role === 'sp') {
    if (ovr >= 70) return 'Ace';
    if (ovr >= 62) return '#1/#2 Starter';
    if (ovr >= 55) return '#3 Starter';
    if (ovr >= 50) return '#4 Starter';
    if (ovr >= 45) return '#5 / Swingman';
    if (ovr >= 40) return 'Spot Starter';
    return 'Organizational';
  }
  if (ovr >= 70) return 'Elite Closer';
  if (ovr >= 60) return 'Late-Inning Arm';
  if (ovr >= 52) return 'Setup Man';
  if (ovr >= 45) return 'Middle Reliever';
  if (ovr >= 40) return 'Mop-Up';
  return 'Organizational';
}

// ---------------------------------------------------------------------------
// Top-level: run the whole card.
// ---------------------------------------------------------------------------

const RATING_KEYS = ['stuff', 'movement', 'hra', 'pbabip', 'control'];

export function evaluatePitcher(input) {
  const { info, stats, ratings, pitches, other, scale } = input;

  const r = {};
  for (const k of RATING_KEYS) {
    r[k] = to2080(ratings[k], scale);
    r[`${k}Pot`] = to2080(ratings[`${k}Pot`], scale);
  }
  const p = {};
  for (const { key } of PITCH_TYPES) {
    p[key] = to2080(pitches[key], scale);
    p[`${key}Pot`] = to2080(pitches[`${key}Pot`], scale);
  }
  const extras = {
    veloTop: parseVelocity(other.velocity),
    gbPct: num(other.gbPct),
    stamina: to2080(other.stamina, scale),
    pitches: p,
  };

  const role = info.role ?? 'sp';
  const tools = computePitchTools(r, extras, role);
  const ability = computePitchAbility(stats, info.level, tools);
  const blended = blendPitch(tools, ability);
  const overall = computePitchOverall(blended, role, ability.results);

  const hasPot =
    RATING_KEYS.some((k) => r[`${k}Pot`] != null) ||
    PITCH_TYPES.some(({ key }) => p[`${key}Pot`] != null);
  const potTools = hasPot ? computePitchTools(r, extras, role, { potential: true }) : null;
  const potOverall = hasPot ? computePitchOverall(potTools, role) : null;

  return { tools, ability, blended, overall, potTools, potOverall, results: ability.results };
}
