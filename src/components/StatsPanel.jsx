import { useState } from 'react';
import { StatRow } from './StatRow';

const STAT_CATEGORIES = [
  { value: 'batting', label: 'Batting' },
  { value: 'pitching', label: 'Pitching' },
];

const BAT_FIELDS = [
  { key: 'avg', label: 'AVG' },
  { key: 'obp', label: 'OBP' },
  { key: 'slg', label: 'SLG' },
  { key: 'ops', label: 'OPS' },
  { key: 'hr', label: 'HR' },
  { key: 'rbi', label: 'RBI' },
  { key: 'r', label: 'R' },
  { key: 'sb', label: 'SB' },
];

const PITCH_FIELDS = [
  { key: 'era', label: 'ERA' },
  { key: 'whip', label: 'WHIP' },
  { key: 'k9', label: 'K/9' },
  { key: 'bb9', label: 'BB/9' },
  { key: 'w', label: 'W' },
  { key: 'l', label: 'L' },
  { key: 'sv', label: 'SV' },
  { key: 'ip', label: 'IP' },
];

function fmt(val, decimals = 3) {
  const n = parseFloat(val);
  if (isNaN(n)) return val ?? '—';
  return n.toFixed(decimals);
}

function renderBat(row) {
  if (!row) return null;
  return BAT_FIELDS.map(({ key, label }) => {
    const raw = row[key] ?? row[key.toUpperCase()];
    const formatted = ['avg', 'obp', 'slg', 'ops'].includes(key) ? fmt(raw) : raw ?? '—';
    return <StatRow key={key} label={label} value={formatted} />;
  });
}

function renderPitch(row) {
  if (!row) return null;
  return PITCH_FIELDS.map(({ key, label }) => {
    const raw = row[key] ?? row[key.toUpperCase()];
    const formatted = ['era', 'whip', 'k9', 'bb9'].includes(key) ? fmt(raw, 2) : raw ?? '—';
    return <StatRow key={key} label={label} value={formatted} />;
  });
}

export function StatsPanel({ batStats, pitchStats }) {
  const [category, setCategory] = useState('batting');

  const batRow = batStats?.[0] ?? null;
  const pitchRow = pitchStats?.[0] ?? null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Team Stats
        </span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-xs border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          {STAT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {category === 'batting' ? renderBat(batRow) : renderPitch(pitchRow)}
      </div>
      {((category === 'batting' && !batRow) || (category === 'pitching' && !pitchRow)) && (
        <p className="text-xs text-gray-400 text-center py-2">No stats available</p>
      )}
    </div>
  );
}
