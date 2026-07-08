// Recommended depth chart for a roster: starters at each position (a player
// can start only one spot), backups, DH, rotation, bullpen, and upgrade
// recommendations.
import {
  FIELD_POSITIONS,
  evaluatePlayer,
  normalizeRatings,
  normalizeFielding,
  positionFits,
  to2080,
  POS_VALUE,
  POS_BAT_ADJ,
} from './evaluation.js';
import { evaluatePitcher } from './pitchingEvaluation.js';

// How much of a lineup slot's score is the bat vs the glove at that spot.
const BAT_WEIGHT = 0.65;

// Defensive-spectrum slides: a player rated at a harder position can handle
// an easier one even with no rating there (OOTP only rates positions a
// player has actually played). Never inferred uphill — a LF doesn't become
// a SS. target: [[source, bonus], ...], inferred fit capped at 60.
const DOWNHILL = {
  '1B': [['SS', 6], ['2B', 5], ['3B', 5], ['CF', 4], ['C', 3], ['RF', 3], ['LF', 3]],
  '2B': [['SS', 3]],
  '3B': [['SS', 2], ['2B', 1]],
  LF: [['CF', 5], ['RF', 2]],
  RF: [['CF', 3]],
};

export function buildDepthChart(players) {
  const batters = [];
  const pitchers = [];

  for (const entry of players) {
    if (entry.type === 'pitcher') {
      const asSp = evaluatePitcher({ ...entry.form, info: { ...entry.form.info, role: 'sp' } }).overall;
      const asRp = evaluatePitcher({ ...entry.form, info: { ...entry.form.info, role: 'rp' } }).overall;
      const stamina = to2080(entry.form.other?.stamina, entry.form.scale);
      pitchers.push({ entry, name: entry.summary.name, role: entry.form.info.role, asSp, asRp, stamina });
    } else {
      const overall = evaluatePlayer(entry.form).overall;
      const listedPos = entry.form.info.position;
      // The OVR bakes in the positional offense credit for the player's
      // LISTED position — neutralize it here so each candidacy below can
      // apply the credit for the position actually being considered.
      const neutral = overall === null ? null : overall - (POS_BAT_ADJ[listedPos] ?? 0);
      const r = normalizeRatings(entry.form.ratings, entry.form.scale);
      const f = normalizeFielding(entry.form.fielding, entry.form.scale);
      const fits = positionFits(f, r, entry.form.posRatings, entry.form.scale);
      batters.push({
        entry,
        name: entry.summary.name,
        overall,
        neutral,
        fits,
        listedPos,
      });
    }
  }

  // Every (batter, position) candidacy: explicit fit first, then a
  // spectrum slide from a harder rated position, then (as a last resort)
  // an assumed-average fit at the player's listed position.
  const candidates = [];
  for (const b of batters) {
    for (const pos of FIELD_POSITIONS) {
      let fit = b.fits[pos]?.fit ?? null;
      let assumed = false;
      let inferred = false;
      if (fit === null) {
        for (const [src, bonus] of DOWNHILL[pos] ?? []) {
          const sf = b.fits[src]?.fit;
          if (sf === null || sf === undefined) continue;
          const slid = Math.min(60, sf + bonus);
          if (fit === null || slid > fit) fit = slid;
        }
        if (fit !== null) inferred = true;
      }
      if (fit === null && b.listedPos === pos) {
        fit = 45;
        assumed = true;
      }
      if (fit === null) continue;
      const batHere = b.neutral === null ? null : b.neutral + (POS_BAT_ADJ[pos] ?? 0);
      const score = batHere !== null ? BAT_WEIGHT * batHere + (1 - BAT_WEIGHT) * fit : fit;
      // Assignment rank includes positional value so a natural SS mans SS
      // before sliding down the spectrum to an easier (higher-fit) spot.
      const rank = score + (POS_VALUE[pos] ?? 0);
      candidates.push({ b, pos, fit: Math.round(fit), assumed, inferred, score, rank });
    }
  }
  candidates.sort((a, z) => z.rank - a.rank);

  // Greedy global assignment: best remaining (player, position) pair wins.
  const starters = {};
  const startingAt = new Map(); // batter → pos
  for (const c of candidates) {
    if (starters[c.pos] || startingAt.has(c.b)) continue;
    starters[c.pos] = c;
    startingAt.set(c.b, c.pos);
  }

  // DH: best remaining bat, judged position-neutrally with the DH credit.
  const dhScore = (b) => (b.neutral === null ? -1 : b.neutral + POS_BAT_ADJ.DH);
  const dhB = batters
    .filter((b) => !startingAt.has(b))
    .sort((a, z) => dhScore(z) - dhScore(a))[0] ?? null;
  const dh = dhB ? { b: dhB, pos: 'DH', fit: null, score: Math.max(0, dhScore(dhB)) } : null;
  if (dhB) startingAt.set(dhB, 'DH');

  // Backups: best candidate not starting at that spot, bench preferred over
  // players already starting elsewhere.
  const backups = {};
  for (const pos of FIELD_POSITIONS) {
    backups[pos] = candidates
      .filter((c) => c.pos === pos && starters[pos]?.b !== c.b)
      .sort((a, z) => {
        const aBench = startingAt.has(a.b) ? 1 : 0;
        const zBench = startingAt.has(z.b) ? 1 : 0;
        if (aBench !== zBench) return aBench - zBench;
        return z.score - a.score;
      })[0] ?? null;
  }

  // Rotation: top five arms by their grade as a starter — but a starter
  // needs a tank (stamina >= 40 when known). Short-arm relievers only get
  // drafted in if the rotation would otherwise be short.
  const bySp = [...pitchers].sort((a, z) => (z.asSp ?? -1) - (a.asSp ?? -1));
  const durable = bySp.filter((p) => p.stamina === null || p.stamina >= 40);
  const rotation = durable.slice(0, 5);
  if (rotation.length < 5) {
    for (const p of bySp) {
      if (rotation.length >= 5) break;
      if (!rotation.includes(p)) rotation.push(p);
    }
  }
  const rotationSet = new Set(rotation);
  const bullpen = pitchers
    .filter((p) => !rotationSet.has(p))
    .sort((a, z) => (z.asRp ?? -1) - (a.asRp ?? -1));

  const upgrades = findUpgrades(starters, backups, dh, rotation, bullpen);

  return { batters, pitchers, starters, backups, dh, rotation, bullpen, upgrades };
}

// ---------------------------------------------------------------------------
// Upgrade recommendations, most urgent first.
// ---------------------------------------------------------------------------

const SEV_ORDER = { high: 0, medium: 1, low: 2 };

function findUpgrades(starters, backups, dh, rotation, bullpen) {
  const ups = [];
  const add = (severity, area, text) => ups.push({ severity, area, text });

  for (const pos of FIELD_POSITIONS) {
    const s = starters[pos];
    if (!s) {
      add('high', pos, `No one on the roster can play ${pos} — acquire a starter.`);
      continue;
    }
    if (s.score < 42) {
      add('high', pos, `${s.b.name} grades ${Math.round(s.score)} at ${pos} — a clear upgrade spot.`);
    } else if (s.score < 48) {
      add('medium', pos, `${s.b.name} is below average at ${pos} (${Math.round(s.score)}) — upgrade candidate.`);
    }
    if (!backups[pos]) {
      add('low', pos, `No backup behind ${s.b.name} at ${pos} — depth is thin.`);
    }
  }

  if (dh && dh.score < 48 && dh.score > 0) {
    add('medium', 'DH', `${dh.b.name} is a light bat for DH (${Math.round(dh.score)}).`);
  } else if (!dh && Object.keys(starters).length > 0) {
    add('medium', 'DH', 'No bat left for DH — the roster has no bench.');
  }

  if (rotation.length < 5) {
    add('high', 'SP', `Only ${rotation.length} starter${rotation.length === 1 ? '' : 's'} on the roster — the rotation is short.`);
  } else {
    const weak = rotation.filter((p) => (p.asSp ?? 0) < 45);
    if (weak.length > 0) {
      add(weak.length >= 3 ? 'high' : 'medium', 'SP',
        `Back of the rotation is weak: ${weak.map((p) => `${p.name} (${p.asSp ?? '—'})`).join(', ')}.`);
    }
  }

  const closer = bullpen[0];
  if (!closer) {
    add('medium', 'RP', 'No relievers left for the bullpen after filling the rotation.');
  } else if ((closer.asRp ?? 0) < 50) {
    add('medium', 'CL', `${closer.name} (${closer.asRp ?? '—'}) is a stretch as the closer.`);
  }

  ups.sort((a, z) => SEV_ORDER[a.severity] - SEV_ORDER[z.severity]);
  return ups;
}
