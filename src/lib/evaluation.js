// Player evaluation engine.
// Everything is normalized to the 20-80 scouting scale internally.
// "Tools" = what the scouting ratings say. "Ability" = what the stats say
// (league-adjusted), falling back to ratings where stats can't measure
// (fielding, arm).

export const RATING_SCALES = [
  { id: '20-80', label: '20–80' },
  { id: '1-100', label: '1–100' },
  { id: '1-10', label: '1–10' },
  { id: '1-5', label: '1–5' },
];

export const LEAGUE_LEVELS = [
  { id: 'mlb', label: 'MLB', offset: 0 },
  { id: 'aaa', label: 'AAA', offset: -6 },
  { id: 'aa', label: 'AA', offset: -10 },
  { id: 'high-a', label: 'High A', offset: -14 },
  { id: 'low-a', label: 'Low A', offset: -17 },
  { id: 'rookie', label: 'Rookie', offset: -20 },
  { id: 'intl', label: 'International / Other', offset: -12 },
];

export const POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

// The five classic tools — the radar chart's axes and the OVR's components.
export const TOOL_AXES = [
  { key: 'hit', label: 'Hit' },
  { key: 'power', label: 'Power' },
  { key: 'run', label: 'Run' },
  { key: 'field', label: 'Field' },
  { key: 'arm', label: 'Arm' },
];
export const FIELD_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

const clamp = (v, lo = 20, hi = 80) => Math.min(hi, Math.max(lo, v));

function num(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Normalize a rating from the chosen input scale to 20-80.
export function to2080(value, scale) {
  const v = num(value);
  if (v === null) return null;
  switch (scale) {
    case '1-100': return clamp(20 + ((v - 1) / 99) * 60);
    case '1-10': return clamp(20 + ((v - 1) / 9) * 60);
    case '1-5': return clamp(20 + ((v - 1) / 4) * 60);
    default: return clamp(v);
  }
}

// Piecewise-linear interpolation through [statValue, grade] anchor points.
function gradeFrom(value, points) {
  if (value === null) return null;
  if (value <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, g1] = points[i - 1];
    const [x2, g2] = points[i];
    if (value <= x2) return g1 + ((value - x1) / (x2 - x1)) * (g2 - g1);
  }
  return points[points.length - 1][1];
}

// MLB-calibrated stat → grade anchors.
const AVG_PTS = [[0.180, 25], [0.220, 35], [0.250, 45], [0.270, 50], [0.290, 55], [0.310, 62], [0.330, 70], [0.350, 78]];
const OBP_PTS = [[0.260, 25], [0.300, 40], [0.320, 45], [0.335, 50], [0.360, 58], [0.380, 64], [0.400, 70], [0.430, 78]];
const SLG_PTS = [[0.300, 25], [0.360, 38], [0.400, 45], [0.430, 50], [0.470, 57], [0.510, 63], [0.550, 70], [0.610, 80]];
const ISO_PTS = [[0.050, 28], [0.090, 38], [0.120, 45], [0.150, 50], [0.180, 57], [0.220, 65], [0.270, 74], [0.320, 80]];
const WRC_PTS = [[40, 20], [70, 35], [85, 43], [100, 50], [115, 57], [130, 64], [150, 72], [180, 80]];
const HR_PTS = [[0, 25], [5, 35], [10, 42], [15, 47], [20, 52], [25, 58], [30, 64], [40, 72], [50, 80]];
const SB_PTS = [[0, 40], [5, 46], [10, 50], [20, 57], [30, 63], [45, 70], [60, 78]];
const TRIP_PTS = [[0, 44], [2, 50], [4, 55], [7, 62], [10, 68], [15, 78]];

// Weighted mean over [value, weight] pairs; ignores null values,
// renormalizing the remaining weights. Returns null if nothing present.
function wMean(pairs) {
  let sum = 0, wt = 0;
  for (const [v, w] of pairs) {
    if (v === null || v === undefined) continue;
    sum += v * w;
    wt += w;
  }
  return wt > 0 ? sum / wt : null;
}

// ---------------------------------------------------------------------------
// Tools — pure scouting ratings, normalized to 20-80.
// ---------------------------------------------------------------------------

export function normalizeRatings(ratings, scale) {
  const n = {};
  for (const [k, v] of Object.entries(ratings)) n[k] = to2080(v, scale);
  return n;
}

export function normalizeFielding(fielding, scale) {
  const n = {};
  for (const [k, v] of Object.entries(fielding)) n[k] = to2080(v, scale);
  return n;
}

function catcherDef(f) {
  return wMean([[f.cBlk, 0.55], [f.cFrm, 0.45]]);
}
function infieldDef(f) {
  return wMean([[f.ifRng, 0.45], [f.ifErr, 0.3], [f.ifDp, 0.25]]);
}
function outfieldDef(f) {
  return wMean([[f.ofRng, 0.65], [f.ofErr, 0.35]]);
}

// r = normalized ratings, f = normalized fielding.
// With `potential: true`, batting ratings use their potential values
// (falling back to current where no potential was entered) — running and
// fielding ratings have no potential inputs, so they stay as-is.
export function computeTools(r, f, { potential = false } = {}) {
  const pick = (cur, pot) => (potential && pot != null ? pot : cur);
  const fieldCandidates = [catcherDef(f), infieldDef(f), outfieldDef(f)].filter((v) => v !== null);
  const armCandidates = [f.cArm, f.ifArm, f.ofArm].filter((v) => v !== null && v !== undefined);
  return {
    hit: wMean([
      [pick(r.contact, r.contactPot), 0.4],
      [pick(r.babip, r.babipPot), 0.2],
      [pick(r.avoidK, r.avoidKPot), 0.2],
      [pick(r.eye, r.eyePot), 0.2],
    ]),
    power: wMean([[pick(r.power, r.powerPot), 0.8], [pick(r.gap, r.gapPot), 0.2]]),
    run: wMean([[r.speed, 0.5], [r.baserunning, 0.3], [r.stealing, 0.2]]),
    field: fieldCandidates.length ? Math.max(...fieldCandidates) : null,
    arm: armCandidates.length ? Math.max(...armCandidates) : null,
  };
}

// ---------------------------------------------------------------------------
// Ability — what the stat line says, translated to an MLB-equivalent grade
// via the league-level offset. Fielding/arm have no stat inputs, so those
// axes fall back to the ratings-based tools.
// ---------------------------------------------------------------------------

export function computeAbility(stats, level, tools) {
  const offset = LEAGUE_LEVELS.find((l) => l.id === level)?.offset ?? 0;
  const adj = (g) => (g === null ? null : clamp(g + offset));

  const avg = num(stats.avg);
  const obp = num(stats.obp);
  const slg = num(stats.slg);
  const wrcPlus = num(stats.wrcPlus);
  const hr = num(stats.hr);
  const sb = num(stats.sb);
  const cs = num(stats.cs);
  const triples = num(stats.triples);
  const iso = avg !== null && slg !== null ? slg - avg : null;

  // wRC+ is already league/park adjusted by OOTP, so no level offset there.
  const hitStat = wMean([
    [adj(gradeFrom(avg, AVG_PTS)), 0.5],
    [adj(gradeFrom(obp, OBP_PTS)), 0.3],
    [gradeFrom(wrcPlus, WRC_PTS), 0.2],
  ]);

  const powerStat = wMean([
    [adj(gradeFrom(slg, SLG_PTS)), 0.35],
    [adj(gradeFrom(iso, ISO_PTS)), 0.35],
    [adj(gradeFrom(hr, HR_PTS)), 0.3],
  ]);

  // Steal grade tempered by success rate: below ~65% success, volume lies.
  let sbGrade = gradeFrom(sb, SB_PTS);
  if (sbGrade !== null && sb !== null && cs !== null && sb + cs >= 5) {
    const rate = sb / (sb + cs);
    sbGrade += (rate - 0.72) * 40; // ±: 72% breakeven-ish
  }
  const runStat = wMean([
    [adj(sbGrade === null ? null : clamp(sbGrade)), 0.6],
    [adj(gradeFrom(triples, TRIP_PTS)), 0.4],
  ]);

  return {
    hit: hitStat ?? tools.hit,
    power: powerStat ?? tools.power,
    run: runStat ?? tools.run,
    field: tools.field, // no fielding stats on the card — ratings carry these
    arm: tools.arm,
    hasStats: hitStat !== null || powerStat !== null || runStat !== null,
  };
}

// ---------------------------------------------------------------------------
// Blended tool values (stats + ratings) — the numbers the OVR is built on.
// When a stat-based grade exists, it's a 50/50 blend with the rating.
// ---------------------------------------------------------------------------

export function computeBlended(tools, ability) {
  const blend = (t, a) => {
    if (t === null && a === null) return null;
    if (t === null) return a;
    if (a === null) return t;
    return t * 0.5 + a * 0.5;
  };
  return {
    hit: blend(tools.hit, ability.hit),
    power: blend(tools.power, ability.power),
    run: blend(tools.run, ability.run),
    field: tools.field,
    arm: tools.arm,
  };
}

// Positional weight profiles for the overall grade — defense matters more
// up the middle, bats matter more at the corners.
const OVR_WEIGHTS = {
  C: { hit: 0.30, power: 0.20, run: 0.06, field: 0.30, arm: 0.14 },
  SS: { hit: 0.30, power: 0.18, run: 0.15, field: 0.24, arm: 0.13 },
  '2B': { hit: 0.31, power: 0.19, run: 0.15, field: 0.24, arm: 0.11 },
  CF: { hit: 0.30, power: 0.20, run: 0.17, field: 0.23, arm: 0.10 },
  '3B': { hit: 0.32, power: 0.26, run: 0.09, field: 0.18, arm: 0.15 },
  RF: { hit: 0.32, power: 0.27, run: 0.10, field: 0.16, arm: 0.15 },
  LF: { hit: 0.34, power: 0.29, run: 0.12, field: 0.16, arm: 0.09 },
  '1B': { hit: 0.35, power: 0.32, run: 0.07, field: 0.18, arm: 0.08 },
  DH: { hit: 0.42, power: 0.38, run: 0.08, field: 0.07, arm: 0.05 },
};

export function computeOverall(blended, position) {
  const w = OVR_WEIGHTS[position] ?? OVR_WEIGHTS.LF;
  const ovr = wMean([
    [blended.hit, w.hit],
    [blended.power, w.power],
    [blended.run, w.run],
    [blended.field, w.field],
    [blended.arm, w.arm],
  ]);
  return ovr === null ? null : Math.round(clamp(ovr));
}

export function gradeLabel(ovr) {
  if (ovr === null) return '—';
  if (ovr >= 75) return 'Franchise Player';
  if (ovr >= 70) return 'Elite';
  if (ovr >= 60) return 'All-Star';
  if (ovr >= 55) return 'Above Average';
  if (ovr >= 50) return 'MLB Regular';
  if (ovr >= 45) return 'Second Division';
  if (ovr >= 40) return 'Bench / Platoon';
  return 'Organizational';
}

// ---------------------------------------------------------------------------
// Recommended positions. Each position gets a suitability score from the
// fielding ratings (+speed where it matters), minus a positional demand tax
// (SS is harder than LF). If the user entered the in-game position OVR/POT
// ratings, those are blended in as the more authoritative signal.
// ---------------------------------------------------------------------------

// How much a position is worth on the defensive spectrum — a player who can
// handle SS is more valuable there than at 1B, so premium positions get a
// bonus in the ranking (scaled by how well he actually fits there).
const POS_VALUE = { C: 8, SS: 8, CF: 6, '2B': 4, '3B': 4, RF: 2, LF: 0, '1B': -6 };

// Minimum arm grade a position realistically demands. An arm below the bar
// docks the computed fit hard — great range can't cover for a 20 arm at SS.
const ARM_REQ = { C: 50, SS: 50, '3B': 55, RF: 55, CF: 45, '2B': 40, LF: 40, '1B': 30 };
const ARM_FOR_POS = {
  C: 'cArm', SS: 'ifArm', '2B': 'ifArm', '3B': 'ifArm', '1B': 'ifArm',
  LF: 'ofArm', CF: 'ofArm', RF: 'ofArm',
};

function armPenalty(pos, f) {
  const arm = f[ARM_FOR_POS[pos]];
  if (arm == null) return 0;
  return Math.max(0, (ARM_REQ[pos] ?? 0) - arm) * 1.2;
}

// A position only gets a computed score if the anchor rating for its
// fielding group was actually entered — speed alone doesn't make a CF.
function rawPosScore(pos, f, r) {
  switch (pos) {
    case 'C':
      if (f.cArm == null && f.cBlk == null && f.cFrm == null) return null;
      return wMean([[f.cBlk, 0.3], [f.cFrm, 0.25], [f.cArm, 0.45]]);
    case 'SS':
      if (f.ifRng == null) return null;
      return wMean([[f.ifRng, 0.45], [f.ifErr, 0.2], [f.ifArm, 0.15], [f.ifDp, 0.2]]);
    case '2B':
      if (f.ifRng == null) return null;
      return wMean([[f.ifRng, 0.4], [f.ifErr, 0.2], [f.ifArm, 0.1], [f.ifDp, 0.3]]);
    case '3B':
      if (f.ifRng == null) return null;
      return wMean([[f.ifRng, 0.3], [f.ifErr, 0.25], [f.ifArm, 0.35], [f.ifDp, 0.1]]);
    case '1B':
      if (f.ifRng == null && f.ifErr == null) return null;
      return wMean([[f.ifRng, 0.25], [f.ifErr, 0.5], [f.ifDp, 0.25]]);
    case 'CF':
      if (f.ofRng == null) return null;
      return wMean([[f.ofRng, 0.5], [f.ofErr, 0.15], [f.ofArm, 0.1], [r.speed, 0.25]]);
    case 'LF':
      if (f.ofRng == null) return null;
      return wMean([[f.ofRng, 0.55], [f.ofErr, 0.25], [f.ofArm, 0.2]]);
    case 'RF':
      if (f.ofRng == null) return null;
      return wMean([[f.ofRng, 0.45], [f.ofErr, 0.2], [f.ofArm, 0.35]]);
    default: return null;
  }
}

// posRatings: { C: { ovr, pot }, ... } on the input scale.
export function recommendPositions(f, r, posRatings, scale) {
  const results = [];
  for (const pos of FIELD_POSITIONS) {
    const raw = rawPosScore(pos, f, r);
    const computed = raw === null ? null : Math.max(20, raw - armPenalty(pos, f));
    const entered = posRatings?.[pos];
    const ovr = to2080(entered?.ovr, scale);
    const pot = to2080(entered?.pot, scale);
    const gameRating = wMean([[ovr, 0.5], [pot, 0.5]]);

    let fit = null;
    if (computed !== null && gameRating !== null) {
      fit = computed * 0.45 + gameRating * 0.55;
    } else if (computed !== null) {
      fit = computed;
    } else if (gameRating !== null) {
      fit = gameRating;
    }
    if (fit === null) continue;

    // Rank by fit plus a positional-value bonus that only applies when the
    // player can actually handle the spot (fades below fit 45, flips to a
    // penalty for a bad fit at a hard position).
    const competence = Math.max(-1, Math.min(1, (fit - 45) / 15));
    const score = fit + (POS_VALUE[pos] ?? 0) * competence;
    results.push({ pos, score, fit: Math.round(fit) });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Top-level: run the whole card.
// ---------------------------------------------------------------------------

const POT_KEYS = ['contactPot', 'babipPot', 'avoidKPot', 'gapPot', 'powerPot', 'eyePot'];

export function evaluatePlayer(input) {
  const { info, stats, ratings, fielding, posRatings, scale } = input;
  const r = normalizeRatings(ratings, scale);
  const f = normalizeFielding(fielding, scale);

  const tools = computeTools(r, f);
  const ability = computeAbility(stats, info.level, tools);
  const blended = computeBlended(tools, ability);
  const overall = computeOverall(blended, info.position);
  const recPositions = recommendPositions(f, r, posRatings, scale);

  // Ceiling grade — scouting potential only (stats measure the present,
  // so they don't factor into what the player could become).
  const hasPot = POT_KEYS.some((k) => r[k] != null);
  const potTools = hasPot ? computeTools(r, f, { potential: true }) : null;
  const potOverall = hasPot ? computeOverall(potTools, info.position) : null;

  return { tools, ability, blended, overall, recPositions, potTools, potOverall };
}
