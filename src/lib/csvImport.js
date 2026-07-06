// CSV import: parse an OOTP / StatsPlus player export, map its columns onto
// the evaluator forms with fuzzy header matching, and run each row through
// the evaluation engine. Each imported entry carries a full form snapshot,
// so it can be saved, loaded into a card, or sent to a trade like any
// hand-entered player.
import Papa from 'papaparse';
import { evaluatePlayer, POSITIONS } from './evaluation.js';
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
  babip: ['babip'], babipPot: ['babipp'],
  avoidK: ['ks', 'avoidk', 'avoidks'], avoidKPot: ['ksp', 'avoidkp'],
  gap: ['gap'], gapPot: ['gapp'],
  power: ['pow', 'power'], powerPot: ['powp', 'powerp'],
  eye: ['eye'], eyePot: ['eyep'],
  speed: ['spe', 'spd', 'speed'],
  stealing: ['ste', 'stl', 'stealing'],
  baserunning: ['run', 'bsr', 'baserunning'],
  sacBunt: ['sac', 'sacbunt'], buntForHit: ['bfh', 'buntforhit'],
};

const BATTER_FIELDING_PREFS = {
  cArm: ['carm'], cBlk: ['cabi', 'cblk', 'cblock'], cFrm: ['cfrm', 'cframe'],
  ifRng: ['ifrng', 'ifrange'], ifErr: ['iferr', 'iferror'], ifArm: ['ifarm'],
  ifDp: ['tdp', 'turndp', 'ifdp'],
  ofRng: ['ofrng', 'ofrange'], ofErr: ['oferr', 'oferror'], ofArm: ['ofarm'],
};

const BATTER_STAT_PREFS = {
  pa: ['pa'], hits: ['h', 'hits'], doubles: ['2b'], triples: ['3b'], hr: ['hr'],
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
  stamina: ['sta', 'stamina'],
  velocity: ['vel', 'velo', 'velocity'],
  gbPct: ['gb', 'gb%'],
  hold: ['hld', 'hold'],
};

const PITCH_BASE = {
  fastball: ['fb', 'fastball'], sinker: ['si', 'snk', 'sinker'],
  cutter: ['ct', 'cutter'], slider: ['sl', 'slider'],
  curveball: ['cb', 'cu', 'curveball'], changeup: ['ch', 'changeup'],
  splitter: ['spl', 'splitter'], forkball: ['fo', 'forkball'],
  circlechange: ['cc', 'circlechange'], screwball: ['sc', 'screwball'],
  knucklecurve: ['kc', 'knucklecurve'], knuckleball: ['kn', 'knuckleball'],
};
const PITCH_PREFS = {
  ...PITCH_BASE,
  ...Object.fromEntries(
    Object.entries(PITCH_BASE).map(([key, aliases]) => [`${key}Pot`, aliases.map((a) => `${a}p`)])
  ),
};

const PITCHER_STAT_PREFS = {
  ip: ['ip'], g: ['g'], gs: ['gs'], k: ['so', 'k'], bb: ['bb'], hr: ['hr'],
  era: ['era'], fip: ['fip'], fipMinus: ['fip-', 'fipminus'],
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
  return v === null || v === undefined ? '' : String(v).trim();
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
const PITCHER_STAT_KEYS = ['ip', 'g', 'gs', 'k', 'bb', 'hr', 'era', 'fip', 'fipMinus', 'whip'];

export function parsePlayersCsv(text, { scale = '20-80', defaultLevel = 'mlb' } = {}) {
  const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
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

  const recognized = new Set(
    [info, bRatings, bFielding, bStats, pRatings, pOther, pStats, pitches].flatMap((m) => Object.values(m))
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
      const form = {
        scale,
        info: { name, role, age, level },
        stats: pick(row, pStats, PITCHER_STAT_KEYS),
        ratings: pick(row, pRatings, PITCHER_RATING_KEYS),
        pitches: pick(row, pitches, Object.keys(PITCH_PREFS)),
        other: pick(row, pOther, ['velocity', 'gbPct', 'stamina', 'hold']),
      };
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
        posRatings: {},
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
        },
      });
    }
  }

  return { players, unmapped, errors: [] };
}
