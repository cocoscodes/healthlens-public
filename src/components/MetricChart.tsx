'use client';

import type { Pt } from '@/lib/view';

const W = 320, H = 140, PL = 46, PR = 10, PT = 12, PB = 22;
const PW = W - PL - PR, PH = H - PT - PB;

function nf(v: number) {
  const a = Math.abs(v);
  return a >= 1000 ? Math.round(v).toLocaleString() : String(Math.round(v * 100) / 100);
}
function fmtX(d: string, g: string) {
  return g === 'daily' ? d.slice(5) : d.slice(2);
}

export default function MetricChart({
  points,
  granularity,
  color = 'var(--accent)',
  band = null,
  sparse = false,
}: {
  points: Pt[];
  granularity: string;
  color?: string;
  band?: { lo: number; hi: number } | null;
  sparse?: boolean;
}) {
  if (!points.length) return <div className="chart-empty">No data</div>;
  const vs = points.map((p) => p.v);
  let mn = Math.min(...vs), mx = Math.max(...vs);
  if (band) { mn = Math.min(mn, band.lo); mx = Math.max(mx, band.hi); }
  if (mn === mx) { mn -= 1; mx += 1; }
  const x = (i: number) => PL + (points.length === 1 ? PW / 2 : (i * PW) / (points.length - 1));
  const y = (v: number) => PT + PH - ((v - mn) / (mx - mn)) * PH;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const yTicks = [mn, (mn + mx) / 2, mx];
  const idxs = points.length <= 2 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const showDots = sparse || points.length <= 14;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }}>
      {band && (
        <rect x={PL} y={y(band.hi)} width={PW} height={Math.max(0, y(band.lo) - y(band.hi))} fill={color} opacity={0.1} />
      )}
      {yTicks.map((t, i) => {
        const yy = y(t);
        return (
          <g key={i}>
            <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="var(--border)" strokeWidth={0.5} />
            <text x={PL - 5} y={yy + 3} textAnchor="end" fontSize={10} fill="var(--muted)">{nf(t)}</text>
          </g>
        );
      })}
      {!sparse && <path d={line} fill="none" stroke={color} strokeWidth={1.8} />}
      {showDots && points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r={2.1} fill={color} />)}
      {idxs.map((i, j) => {
        const anchor = j === 0 ? 'start' : j === idxs.length - 1 ? 'end' : 'middle';
        const xx = j === 0 ? PL : j === idxs.length - 1 ? W - PR : x(i);
        return (
          <text key={i} x={xx} y={H - 6} textAnchor={anchor} fontSize={10} fill="var(--muted)">
            {fmtX(points[i].d, granularity)}
          </text>
        );
      })}
    </svg>
  );
}
