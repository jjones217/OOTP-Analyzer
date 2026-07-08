import { useState } from 'react';
import { TOOL_AXES } from '../../lib/evaluation';

const CX = 160;
const CY = 152;
const R = 104;
const RINGS = [35, 50, 65, 80];
const MIN = 20;
const MAX = 80;

function polar(i, value) {
  const t = (Math.min(MAX, Math.max(MIN, value)) - MIN) / (MAX - MIN);
  const angle = (-90 + i * 72) * (Math.PI / 180);
  return [CX + t * R * Math.cos(angle), CY + t * R * Math.sin(angle)];
}

function ringPath(axes, value) {
  return axes
    .map((_, i) => {
      const [x, y] = polar(i, value);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ') + ' Z';
}

function seriesPath(axes, values) {
  return axes
    .map(({ key }, i) => {
      const [x, y] = polar(i, values[key] ?? MIN);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ') + ' Z';
}

const fmt = (v) => (v === null || v === undefined ? '—' : Math.round(Math.min(80, Math.max(20, v)) / 5) * 5);

// Pentagon radar on the 20-80 scale over five axes (default: the classic
// batting tools; pass `axes` for other cards, e.g. pitching).
// tools/ability: values keyed by axis (20-80 or null).
// mode: 'tools' | 'ability' | 'both'
export function RadarChart({ tools, ability, mode = 'both', axes = TOOL_AXES }) {
  const [hover, setHover] = useState(null);

  const showTools = mode !== 'ability';
  const showAbility = mode !== 'tools';

  return (
    <div className="relative">
      <svg viewBox="-12 0 344 300" className="w-full max-w-sm mx-auto" role="img" aria-label="Player tool grades radar chart">
        {/* grid rings + spokes */}
        {RINGS.map((v) => (
          <path key={v} d={ringPath(axes, v)} fill="none" stroke="var(--chart-grid)" strokeWidth="1" />
        ))}
        {axes.map((_, i) => {
          const [x, y] = polar(i, MAX);
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />;
        })}
        {/* ring value labels, tucked inside just below the top spoke */}
        {[50, 80].map((v) => {
          const [x, y] = polar(0, v);
          return (
            <text key={v} x={x + 4} y={y + 11} fontSize="8.5" fill="var(--chart-muted)">{v}</text>
          );
        })}

        {/* series polygons */}
        {showAbility && (
          <path d={seriesPath(axes, ability)} fill="var(--series-ability)" fillOpacity="0.14" stroke="var(--series-ability)" strokeWidth="2" strokeLinejoin="round" />
        )}
        {showTools && (
          <path d={seriesPath(axes, tools)} fill="var(--series-tools)" fillOpacity="0.14" stroke="var(--series-tools)" strokeWidth="2" strokeLinejoin="round" />
        )}

        {/* vertex markers */}
        {axes.map(({ key }, i) => {
          const pts = [];
          if (showAbility) pts.push({ v: ability[key], color: 'var(--series-ability)' });
          if (showTools) pts.push({ v: tools[key], color: 'var(--series-tools)' });
          return pts.map(({ v, color }, j) => {
            const [x, y] = polar(i, v ?? MIN);
            return (
              <circle
                key={`${key}-${j}`}
                cx={x} cy={y} r="4"
                fill={v == null ? 'var(--chart-surface)' : color}
                stroke={color} strokeWidth="1.5"
              />
            );
          });
        })}

        {/* axis labels + hover targets */}
        {axes.map(({ key, label }, i) => {
          const [x, y] = polar(i, MAX + 11);
          const anchor = Math.abs(x - CX) < 8 ? 'middle' : x > CX ? 'start' : 'end';
          return (
            <g key={key}>
              <text
                x={x} y={y + 4} fontSize="12" fontWeight="600"
                textAnchor={anchor}
                fill={hover === i ? 'var(--chart-ink)' : 'var(--chart-ink-2)'}
              >
                {label}
              </text>
              <circle
                cx={polar(i, MAX)[0]} cy={polar(i, MAX)[1]} r="26"
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {/* hover tooltip */}
      {hover !== null && (
        <div className="absolute top-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none">
          <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{axes[hover].label}</div>
          {showTools && (
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--series-tools)' }} />
              Tools: <span className="font-semibold tabular-nums">{fmt(tools[axes[hover].key])}</span>
            </div>
          )}
          {showAbility && (
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--series-ability)' }} />
              Ability: <span className="font-semibold tabular-nums">{fmt(ability[axes[hover].key])}</span>
            </div>
          )}
        </div>
      )}

      {/* legend */}
      {mode === 'both' && (
        <div className="flex justify-center gap-5 mt-1 text-xs text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--series-tools)' }} /> Tools (ratings)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--series-ability)' }} /> Ability (stats)
          </span>
        </div>
      )}
    </div>
  );
}
