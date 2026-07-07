// CSV import: parse an OOTP / StatsPlus player export, map its columns onto
// the evaluator forms with fuzzy header matching, and run each row through
// the evaluation engine. Each imported entry carries a full form snapshot,
// so it can be saved, loaded into a card, or sent to a trade like any
// hand-entered player.
import Papa from 'papaparse';
import { evaluatePlayer, POSITIONS, FIELD_POSITIONS } from './evaluation.js';
import { evaluatePitcher, PITCHER_ROLES } from './pitchingEvaluation.js';

const norm = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9+%-]/g, '');

// field key → aliases in preference order (first match in the CSV wins).
// Specific aliases come before ambiguous ones — "CTL" beats "CON" for pitcher
// control, since "CON" is batter contact in the same export. Potential
// columns in OOTP exports are the rating header with a "P" suffix
// ("CON P", "POW P"), which normalizes to conp/powp.
const INFO_PREFS = {
  name: ['name', 'player', 'playername', 'title'],
  pos: ['pos', 'position'],
  age: ['age'],
  level: ['lev', 'level', 'league', 'lg'],
};

const BATTER_RATING_PREFS = {
  contact: ['con', 'contact'], contactPot: ['conp', 'contactpot'],
  babip: ['babip'], babipPot: ['babipp', 'htp'],
  avoidK: ['ks', 'avoidk', 'avoidks'], avoidKPot: ['ksp', 'kp', 'avoidkp'],
  gap: ['gap'], gapPot: ['gapp'],
  power: ['pow', 'power'], powerPot: ['powp', 'powerp'],
  eye: ['eye'], eyePot: ['eyep'],
  speed: ['spe', 'spd', 'speed'],
  stlAggr: ['sr', 'stlaggr'],
  stealing: ['ste', 'stl', 'stealing'],
  baserunning: ['run', 'bsr', 'baserunning'],
  sacBunt: ['bun', 'sac', 'sacbunt'], buntForHit: ['bfh', 'buntforhit'],
};

const BATTER_FIELDING_PREFS = {
  cArm: ['carm'], cBlk: ['cabi', 'cblk', 'cblock'], cFrm: ['cfrm', 'cframe'],
  ifRng: ['ifrng', 'ifrange'], ifErr: ['iferr', 'iferror'], ifArm: ['ifarm'],
  ifDp: ['tdp', 'turndp', 'ifdp'],
  ofRng: ['ofrng', 'ofrange'], ofErr: ['oferr', 'oferror'], ofArm: ['ofarm'],
};

const BATTER_STAT_PREFS = {
  pa: ['pa'], hits: ['h', 'hits'], doubles: ['2b1', '2b'], triples: ['3b1', '3b'], hr: ['hr'],
  bb: ['bb'], k: ['so', 'k'],
  avg: ['avg', 'ba'], obp: ['obp'], slg: ['slg'],
  wrcPlus: ['wrc+', 'wrcplus', 'wrc'],
  sb: ['sb'], cs: ['cs'],
};

const PITCHER_RATING_PREFS = {
  stuff: ['stu', 'stuff'], stuffPot: ['stup', 'stuffp'],
  movement: ['mov', 'movement'], movementPot: ['movp', 'movementp'],
  control: ['ctl', 'control', 'con'], controlPot: ['ctlp', 'controlp', 'conp'],
  hra: ['hra'], hraPot: ['hrap'],
  pbabip: ['pbabip'], pbabipPot: ['pbabipp'],
};

const PITCHER_OTHER_PREFS = {
  stamina: ['sta', 'stm', 'stamina'],
  velocity: ['vel', 'velo', 'vt', 'velocity'],
  gbPct: ['gb', 'gb%', 'gf'],
  hold: ['hld', 'hold'],
};

// The G/F column is text ("EX GB", "NEU", ...) — translate to a GB% guess.
const GB_TYPE = { exgb: 62, gb: 54, neu: 45, fb: 38, exfb: 32 };
function gbValue(raw) {
  if (raw === '') return '';
  if (Number.isFinite(Number(raw))) return raw;
  const mapped = GB_TYPE[norm(raw)];
  return mapped === undefined ? '' : String(mapped);
}

const PITCH_BASE = {
  fastball: ['fb', 'fastball'], sinker: ['si', 'snk', 'sinker'],
  cutter: ['ct', 'cutter'], slider: ['sl', 'slider'],
  curveball: ['cb', 'cu', 'curveball'], changeup: ['ch', 'changeup'],
  splitter: ['spl', 'sp', 'splitter'], forkball: ['fo', 'forkball'],
  circlechange: ['cc', 'circlechange'], screwball: ['sc', 'screwball'],
  knucklecurve: ['kc', 'knucklecurve'], knuckleball: ['kn', 'knuckleball'],
};
const PITCH_PREFS = {
  ...PITCH_BASE,
  ...Object.fromEntries(
    Object.entries(PITCH_BASE).map(([key, aliases]) => [`${key}Pot`, aliases.map((a) => `${a}p`)])
  ),
};

const WAR_PREFS = { war: ['war'] };

// Position-rating columns: a bare position header ("SS") plus "SS Pot".
// "2B"/"3B" also name the doubles/triples stats — when both appear, papaparse
// suffixes the later duplicate to "2B_1", which the stat prefs prefer.
const POS_RATING_PREFS = Object.fromEntries(
  FIELD_POSITIONS.flatMap((pos) => [
    [pos, [norm(pos)]],
    [`${pos}Pot`, [`${norm(pos)}pot`]],
  ])
);

const PITCHER_STAT_PREFS = {
  ip: ['ip'], g: ['g'], gs: ['gs'], k: ['so', 'k'], bb: ['bb'], hr: ['hr'],
  era: ['era'], eraPlus: ['era+', 'eraplus'], fip: ['fip'], fipMinus: ['fip-', 'fipminus'],
  whip: ['whip'],
};

const LEVEL_ALIASES = {
  mlb: 'mlb', ml: 'mlb', majors: 'mlb',
  aaa: 'aaa', aa: 'aa',
  'a+': 'high-a', hia: 'high-a', higha: 'high-a',
  a: 'low-a', 'a-': 'low-a', lowa: 'low-a',
  r: 'rookie', rk: 'rookie', rookie: 'rookie',
  int: 'intl', intl: 'intl',
};

const PITCHER_POS = new Set(['p', 'sp', 'rp', 'cl', 'mr']);

const val = (row, rawKey) => {
  if (rawKey === undefined) return '';
  const v = row[rawKey];
  if (v === null || v === undefined) return '';
  const t = String(v).trim();
  return t === '-' ? '' : t; // OOTP prints '-' for hidden/absent ratings
};

// Build header lookup: our-field-key → raw CSV header, taking each key's
// first alias that appears in the file.
function mapHeaders(fields, prefs) {
  const byNorm = {};
  for (const raw of fields) {
    const n = norm(raw);
    if (!(n in byNorm)) byNorm[n] = raw;
  }
  const map = {};
  for (const [key, aliases] of Object.entries(prefs)) {
    for (const a of aliases) {
      if (byNorm[a] !== undefined) {
        map[key] = byNorm[a];
        break;
      }
    }
  }
  return map;
}

function pick(row, headerMap, keys) {
  const out = {};
  for (const k of keys) out[k] = val(row, headerMap[k]);
  return out;
}

const BATTER_RATING_KEYS = [
  'contact', 'contactPot', 'babip', 'babipPot', 'avoidK', 'avoidKPot',
  'gap', 'gapPot', 'power', 'powerPot', 'eye', 'eyePot',
  'speed', 'stlAggr', 'stealing', 'baserunning', 'sacBunt', 'buntForHit',
];
const BATTER_FIELDING_KEYS = ['cArm', 'cBlk', 'cFrm', 'ifRng', 'ifErr', 'ifArm', 'ifDp', 'ofRng', 'ofErr', 'ofArm'];
const BATTER_STAT_KEYS = ['pa', 'hits', 'doubles', 'triples', 'hr', 'bb', 'k', 'avg', 'obp', 'slg', 'wrcPlus', 'sb', 'cs'];
const PITCHER_RATING_KEYS = ['stuff', 'stuffPot', 'movement', 'movementPot', 'hra', 'hraPot', 'pbabip', 'pbabipPot', 'control', 'controlPot'];
const PITCHER_STAT_KEYS = ['ip', 'g', 'gs', 'k', 'bb', 'hr', 'era', 'eraPlus', 'fip', 'fipMinus', 'whip'];

export function parsePlayersCsv(text, { scale = '20-80', defaultLevel = 'mlb' } = {}) {
  // Normalize line endings — pasted text can mix CRLF and LF, which throws
  // off papaparse's newline detection.
  const cleaned = text.replace(/\r\n?/g, '\n').trim();
  const parsed = Papa.parse(cleaned, { header: true, skipEmptyLines: true });
  const fields = parsed.meta?.fields ?? [];
  if (fields.length < 2 || parsed.data.length === 0) {
    return { players: [], unmapped: [], errors: ['Could not find a header row and data rows in that CSV.'] };
  }

  const info = mapHeaders(fields, INFO_PREFS);
  const bRatings = mapHeaders(fields, BATTER_RATING_PREFS);
  const bFielding = mapHeaders(fields, BATTER_FIELDING_PREFS);
  const bStats = mapHeaders(fields, BATTER_STAT_PREFS);
  const pRatings = mapHeaders(fields, PITCHER_RATING_PREFS);
  const pOther = mapHeaders(fields, PITCHER_OTHER_PREFS);
  const pStats = mapHeaders(fields, PITCHER_STAT_PREFS);
  const pitches = mapHeaders(fields, PITCH_PREFS);
  const posRatingCols = mapHeaders(fields, POS_RATING_PREFS);
  const warCol = mapHeaders(fields, WAR_PREFS);

  // Without the "X Pot" columns there's no position-rating block, so a bare
  // "2B"/"3B" header is the doubles/triples stat, not a position rating.
  const hasPosBlock = FIELD_POSITIONS.some((pos) => posRatingCols[`${pos}Pot`] !== undefined);
  if (!hasPosBlock) {
    for (const pos of FIELD_POSITIONS) delete posRatingCols[pos];
  }

  const recognized = new Set(
    [info, bRatings, bFielding, bStats, pRatings, pOther, pStats, pitches, posRatingCols, warCol].flatMap((m) => Object.values(m))
  );
  const unmapped = fields.filter((f) => !recognized.has(f));

  const players = [];
  for (const row of parsed.data) {
    const name = val(row, info.name);
    const posRaw = val(row, info.pos).toLowerCase();
    if (!name && !posRaw) continue;

    const age = val(row, info.age);
    const level = LEVEL_ALIASES[norm(val(row, info.level))] ?? defaultLevel;
    const isPitcher = PITCHER_POS.has(posRaw) || (!posRaw && val(row, pRatings.stuff) !== '');

    if (isPitcher) {
      const role = PITCHER_ROLES.some((r) => r.id === posRaw) ? posRaw : 'sp';
      // A hitting export lists pitchers too, and its HR/BB/K columns are
      // their *batting* stats — only read pitching stats from a file that
      // actually looks like a pitching export.
      const isPitchingFile = pStats.ip !== undefined || pStats.era !== undefined;
      const form = {
        scale,
        info: { name, role, age, level },
        stats: isPitchingFile
          ? pick(row, pStats, PITCHER_STAT_KEYS)
          : Object.fromEntries(PITCHER_STAT_KEYS.map((k) => [k, ''])),
        ratings: pick(row, pRatings, PITCHER_RATING_KEYS),
        pitches: pick(row, pitches, Object.keys(PITCH_PREFS)),
        other: pick(row, pOther, ['velocity', 'gbPct', 'stamina', 'hold']),
      };
      form.other.gbPct = gbValue(form.other.gbPct);
      const evaluation = evaluatePitcher(form);
      players.push({
        type: 'pitcher',
        form,
        summary: {
          name: name || 'Unnamed',
          detail: role.toUpperCase(),
          age,
          level,
          ovr: evaluation.overall,
          pot: evaluation.potOverall,
          war: val(row, warCol.war),
        },
      });
    } else {
      const upper = posRaw.toUpperCase();
      const position = POSITIONS.includes(upper) ? upper : 'DH';
      const form = {
        scale,
        info: { name, position, age, level },
        stats: pick(row, bStats, BATTER_STAT_KEYS),
        ratings: pick(row, bRatings, BATTER_RATING_KEYS),
        fielding: pick(row, bFielding, BATTER_FIELDING_KEYS),
        posRatings: Object.fromEntries(
          FIELD_POSITIONS.map((pos) => [
            pos,
            { ovr: val(row, posRatingCols[pos]), pot: val(row, posRatingCols[`${pos}Pot`]) },
          ])
        ),
      };
      const evaluation = evaluatePlayer(form);
      players.push({
        type: 'batter',
        form,
        summary: {
          name: name || 'Unnamed',
          detail: position,
          age,
          level,
          ovr: evaluation.overall,
          pot: evaluation.potOverall,
          war: val(row, warCol.war),
        },
      });
    }
  }

  return { players, unmapped, errors: [] };
}
