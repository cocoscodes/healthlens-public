'use client';

import { useState } from 'react';
import type { MetricView } from '@/lib/view';
import MetricChart from './MetricChart';

const ARROW: Record<string, string> = { up: '↗', down: '↘', flat: '→' };
type Granularity = 'monthly' | 'weekly' | 'daily';

export default function MetricCard({ view }: { view: MetricView }) {
  const avail = (['monthly', 'weekly', 'daily'] as Granularity[]).filter((g) => view[g].length);
  const [g, setG] = useState<Granularity>(
    avail.includes(view.defView as Granularity) ? (view.defView as Granularity) : avail[avail.length - 1] || 'daily',
  );

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-label">{view.label}</span>
        <span className="card-trend">{ARROW[view.trend]}</span>
      </div>
      <div className="card-value">
        {view.head != null ? view.head.toLocaleString() : '—'}
        <span className="card-unit">{view.unit}</span>
      </div>
      <div className="card-sub">
        {view.headKind}
        {view.headDate ? ` · ${view.headDate}` : ''}
      </div>
      <MetricChart points={view[g]} granularity={g} />
      <div className="card-foot">
        {avail.map((opt) => (
          <button key={opt} className={opt === g ? 'tg on' : 'tg'} onClick={() => setG(opt)}>
            {opt}
          </button>
        ))}
        {view.sparse && <span className="tag">sparse · {view.count}</span>}
      </div>
    </div>
  );
}
