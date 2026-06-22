'use client';

import type { Pt } from '@/lib/view';

const W = 320, H = 150, PL = 46, PR = 10, PT = 12, PB = 30;
const PW = W - PL - PR, PH = H - PT - PB;
const PAL = ['#8a93a3', '#e0a64e', '#36d39a', '#ff5a6e'];

function nf(v: number) {
  const a = Math.abs(v);
  return a >= 1000 ? Math.round(v).toLocaleString() : String(Math.round(v * 100) / 100);
}

/** Overlay each calendar year as its own line, aligned by month (Jan–Dec). */
export default function YoYChart({ monthly, color = 'var(--accent)' }: { monthly: Pt[]; color?: string }) {
  const byYear: Record<string, Record<number, number>> = {};
  for (const p of monthly) {
    const [y, m] = p.d.split('-');
    (byYear[y] = byYear[y] || {})[+m] = p.v;
  }
  const years = Object.keys(byYear).sort();
  if (years.length < 2) return <div className="chart-empty">Need 2+ years</div>;
  const vs = monthly.map((p) => p.v);
  let mn = Math.min(...vs), mx = Math.max(...vs);
  if (mn === mx) { mn -= 1; mx += 1; }
  const x = (m: number) => PL + ((m - 1) / 11) * PW;
  const y = (v: number) => PT + PH - ((v - mn) / (mx - mn)) * PH;
  const yTicks = [mn, (mn + mx) / 2, mx];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: 'auto', display: 'block' }}>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} y1={y(t)} x2={W - PR} y2={y(t)} stroke="var(--border)" strokeWidth={0.5} />
          <text x={PL - 5} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">{nf(t)}</text>
        </g>
      ))}
      {years.map((yr, i) => {
        const col = i === years.length - 1 ? color : PAL[i % PAL.length];
        let d = '', started = false;
        for (let m = 1; m <= 12; m++) {
          const v = byYear[yr][m];
          if (v == null) continue;
          d += `${started ? 'L' : 'M'}${x(m).toFixed(1)} ${y(v).toFixed(1)} `;
          started = true;
        }
        return <path key={yr} d={d} fill="none" stroke={col} strokeWidth={1.6} />;
      })}
      {[[1, 'Jan'], [6, 'Jun'], [12, 'Dec']].map((a, j) => {
        const anchor = j === 0 ? 'start' : j === 2 ? 'end' : 'middle';
        const xx = j === 0 ? PL : j === 2 ? W - PR : x(a[0] as number);
        return <text key={j} x={xx} y={H - 16} textAnchor={anchor} fontSize={10} fill="var(--muted)">{a[1]}</text>;
      })}
      {years.map((yr, i) => (
        <text key={yr} x={PL + i * 40} y={H - 2} fontSize={9} fill={i === years.length - 1 ? color : PAL[i % PAL.length]}>{yr}</text>
      ))}
    </svg>
  );
}
