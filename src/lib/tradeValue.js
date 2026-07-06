// Trade value engine.
// Converts a player's card (OVR/POT grade, age, level, control, salary,
// durability) into trade-value points — discounted, risk-adjusted projected
// WAR over the years of team control. Points are comparable across players,
// so summing a side gives the package's worth.
import { LEAGUE_LEVELS, to2080, num, gradeFrom } from './evaluation.js';

export { LEAGUE_LEVELS };

export const INJURY_PRONE = [
  { id: 'durable', label: 'Durable', factor: 1.05 },
  { id: 'normal', label: 'Normal', factor: 1.0 },
  { id: 'fragile', label: 'Fragile', factor: 0.85 },
];

// Grade → expected annual WAR at peak. The curve is convex on purpose:
// one 70 is worth far more than two 50s.
const WAR_PTS = [[40, 0.3], [45, 1.0], [50, 2.0], [55, 3.2], [60, 4.5], [65, 5.8], [70, 7.0], [75, 8.3], [80, 9.5]];

// Chance a prospect reaches his scouted ceiling, by level...
const DEV_PROB = { mlb: 0.85, aaa: 0.6, aa: 0.45, 'high-a': 0.35, 'low-a': 0.28, rookie: 0.2, intl: 0.4 };
// ...and how many years he's still away from the majors.
const ETA_YEARS = { mlb: 0, aaa: 1, aa: 2, 'high-a': 3, 'low-a': 3.5, rookie: 4, intl: 2.5 };

const DISCOUNT = 0.92; // per-year time discount — a WAR now beats a WAR later
const WAR_COST = 8; // $M per WAR, for the salary offset

// Production multiplier by age — flat through 29, ~8%/yr decline after.
function agingFactor(age) {
  return age <= 29 ? 1 : DISCOUNT ** (age - 29);
}

// Chance the player converts his ceiling, by level and age — younger
// players at higher levels convert more of their potential.
export function reachProbability(age, level) {
  const base = DEV_PROB[level] ?? 0.5;
  const ageFactor = Math.min(1.35, Math.max(0.5, 1 + (23 - (age ?? 25)) * 0.07));
  return Math.min(0.95, base * ageFactor);
}

// Display grade: current plus risk-weighted share of the gap to the ceiling.
export function effectiveGrade(ovr, pot, age, level) {
  if (ovr === null && pot === null) return null;
  if (ovr === null) return pot;
  if (pot === null || pot <= ovr) return ovr;
  return ovr + (pot - ovr) * reachProbability(age, level);
}

// Expected annual WAR over the outcome distribution, not WAR of the average
// outcome — the WAR curve is convex, so a boom-or-bust prospect is worth
// more than his "average" grade suggests.
function expectedWar(ovr, pot, age, level) {
  if (ovr === null && pot === null) return null;
  if (ovr === null) return gradeFrom(pot, WAR_PTS) * reachProbability(age, level);
  if (pot === null || pot <= ovr) return gradeFrom(ovr, WAR_PTS);
  const p = reachProbability(age, level);
  return (1 - p) * gradeFrom(ovr, WAR_PTS) + p * gradeFrom(pot, WAR_PTS);
}

export function defaultControlYears(level) {
  return level === 'mlb' ? 3 : 6;
}

// player: { ovr, pot, age, level, controlYears, salary, injury } (raw form
// values). Players pushed in from the evaluators carry their own scale
// (computed grades are always 20-80) — it wins over the trade's scale.
export function playerTradeValue(player, scale) {
  const scaleUsed = player.scale ?? scale;
  const ovr = to2080(player.ovr, scaleUsed);
  const pot = to2080(player.pot, scaleUsed);
  const age = num(player.age) ?? 25;
  const level = player.level ?? 'mlb';
  const control = num(player.controlYears) ?? defaultControlYears(level);
  const salary = num(player.salary);
  const injuryFactor = INJURY_PRONE.find((i) => i.id === player.injury)?.factor ?? 1;

  const grade = effectiveGrade(ovr, pot, age, level);
  if (grade === null) return { value: null, grade: null, annualWar: null };

  const annualWar = Math.max(0, expectedWar(ovr, pot, age, level));
  const eta = ETA_YEARS[level] ?? 0;

  // Sum projected WAR over the control window: delayed by ETA for
  // prospects, aged, time-discounted, durability-adjusted.
  let war = 0;
  let cost = 0;
  for (let t = 0; t < control; t++) {
    const yearsOut = eta + t;
    const ageThen = age + yearsOut;
    if (ageThen >= 40) break;
    const factor = agingFactor(ageThen) * DISCOUNT ** yearsOut;
    war += annualWar * factor;
    if (salary !== null) cost += (salary / WAR_COST) * DISCOUNT ** yearsOut;
  }
  war *= injuryFactor;

  const value = Math.max(0, war - cost);
  return {
    value: Math.round(value * 10) / 10,
    grade: Math.round(grade),
    annualWar: Math.round(annualWar * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Free-agent offer recommendation: contract length from age and quality,
// salary from projected WAR over that contract at the market $/WAR rate.
// ---------------------------------------------------------------------------

const round1 = (v) => Math.round(v * 10) / 10;

export function faOffer(player, scale) {
  const scaleUsed = player.scale ?? scale ?? '20-80';
  const ovr = to2080(player.ovr, scaleUsed);
  const pot = to2080(player.pot, scaleUsed);
  const age = num(player.age) ?? 27;
  const level = player.level ?? 'mlb';

  const war = expectedWar(ovr, pot, age, level);
  if (war === null) return null;
  if (war < 0.5) return { minimum: true, years: 1, aav: 1, total: 1, maxAav: 1.5, ageAssumed: num(player.age) === null };

  // Contract length: age sets the base, quality stretches or shortens it.
  let years = age <= 25 ? 6 : age <= 28 ? 5 : age <= 30 ? 4 : age <= 32 ? 3 : age <= 34 ? 2 : 1;
  const grade = effectiveGrade(ovr, pot, age, level);
  if (grade >= 62) years += 1;
  if (grade < 50) years = Math.max(1, years - 1);
  years = Math.min(years, 8);

  // Pay for the average projected season across the deal, decline included —
  // that's what makes long contracts for older players price themselves down.
  let sum = 0;
  for (let t = 0; t < years; t++) sum += war * agingFactor(age + t);
  const aav = Math.max(1, (sum / years) * WAR_COST);

  return {
    minimum: false,
    years,
    aav: round1(aav),
    total: round1(aav * years),
    maxAav: round1(aav * 1.15), // walk-away number: ~15% over fair
    ageAssumed: num(player.age) === null,
  };
}

export function sideTotal(players, scale) {
  let sum = 0;
  for (const p of players) {
    const { value } = playerTradeValue(p, scale);
    if (value !== null) sum += value;
  }
  return Math.round(sum * 10) / 10;
}

// Verdict on the gap between the two sides.
export function tradeVerdict(totalA, totalB, labelA, labelB) {
  if (totalA === 0 && totalB === 0) return { text: 'Add players to both sides.', tone: 'muted' };
  const max = Math.max(totalA, totalB);
  if (max === 0) return { text: 'Add players to both sides.', tone: 'muted' };
  const gapPct = (Math.abs(totalA - totalB) / max) * 100;
  const winner = totalA > totalB ? labelA : labelB;
  if (gapPct < 10) return { text: 'Fair trade — the sides are within 10%.', tone: 'fair' };
  if (gapPct < 25) return { text: `Slight win for ${winner} (+${Math.round(gapPct)}%).`, tone: 'slight' };
  return { text: `Clear win for ${winner} (+${Math.round(gapPct)}%).`, tone: 'clear' };
}
