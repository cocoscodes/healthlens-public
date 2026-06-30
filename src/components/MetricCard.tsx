'use client';

import { useState } from 'react';
import type { MetricView } from '@/lib/view';
import MetricChart from './MetricChart';
import YoYChart from './YoYChart';

const ARROW: Record<string, string> = { up: '↗', down: '↘', flat: '→' };
type Granularity = 'monthly' | 'weekly' | 'daily' | 'yoy';

function favClass(good: string, trend: string) {
  if (trend === 'flat' || good === 'neutral') return 'tr-neutral';
  return trend === good ? 'tr-good' : 'tr-bad';
}
function trendLabel(good: string, trend: string) {
  const dir = trend === 'up' ? 'rising' : trend === 'down' ? 'falling' : 'flat';
  if (trend === 'flat' || good === 'neutral') return `Trend: ${dir}`;
  return `Trend: ${dir} (${trend === good ? 'favorable' : 'unfavorable'})`;
}

export default function MetricCard({ view }: { view: MetricView }) {
  const base = (['monthly', 'weekly', 'daily'] as const).filter((g) => view[g].length);
  const years = new Set(view.monthly.map((p) => p.d.slice(0, 4)));
  const tabs: Granularity[] = [...base];
  if (years.size >= 2) tabs.push('yoy');
  const [g, setG] = useState<Granularity>(
    base.includes(view.defView as 'monthly' | 'weekly' | 'daily') ? (view.defView as Granularity) : base[base.length - 1] || 'daily',
  );

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-label">{view.label}</span>
        <span
          className={`card-trend ${favClass(view.good, view.trend)}`}
          role="img"
          aria-label={trendLabel(view.good, view.trend)}
          title={trendLabel(view.good, view.trend)}
        >
          {ARROW[view.trend]}
        </span>
      </div>
      <div className="card-value">
        {view.head != null ? view.head.toLocaleString() : '—'}
        <span className="card-unit">{view.unit}</span>
      </div>
      <div className="card-sub">
        {view.headKind}
        {view.headDate ? ` · ${view.headDate}` : ''}
      </div>
      {g === 'yoy' ? (
        <YoYChart monthly={view.monthly} label={view.label} />
      ) : (
        <MetricChart points={view[g]} granularity={g} band={view.band} sparse={view.sparse} label={view.label} />
      )}
      <div className="card-foot" role="group" aria-label={`${view.label} chart range`}>
        {tabs.map((opt) => (
          <button
            key={opt}
            className={opt === g ? 'tg on' : 'tg'}
            aria-pressed={opt === g}
            onClick={() => setG(opt)}
          >
            {opt}
          </button>
        ))}
        {view.sparse && <span className="tag">sparse · {view.count}</span>}
      </div>
    </div>
  );
}
