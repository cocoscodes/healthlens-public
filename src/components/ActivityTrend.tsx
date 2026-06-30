'use client';

import { useState } from 'react';
import type { Snapshot } from '@/lib/types';
import { isoWeek } from '@/lib/aggregator';
import type { Pt } from '@/lib/view';
import MetricChart from './MetricChart';

type Ring = { move: number; exer: number; stand: number };

function group(snap: Snapshot, keyFn: (d: string) => string) {
  const m = new Map<string, Ring & { n: number }>();
  for (const a of snap.activity || []) {
    const k = keyFn(a.date);
    const o = m.get(k) || { move: 0, exer: 0, stand: 0, n: 0 };
    o.move += a.moveKcal; o.exer += a.exerciseMin; o.stand += a.standHours; o.n++;
    m.set(k, o);
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  return [...m.entries()].sort().map(([d, o]) => ({ d, move: r(o.move / o.n), exer: r(o.exer / o.n), stand: r(o.stand / o.n) }));
}

function Card({ label, unit, monthly, weekly, color }: { label: string; unit: string; monthly: Pt[]; weekly: Pt[]; color: string }) {
  const [g, setG] = useState<'monthly' | 'weekly'>('monthly');
  const pts = g === 'monthly' ? monthly : weekly;
  const head = pts.length ? pts[pts.length - 1].v : null; // reflects selected range
  return (
    <div className="card">
      <div className="card-head"><span className="card-label">{label}</span></div>
      <div className="card-value">{head != null ? head.toLocaleString() : '—'}<span className="card-unit">{unit}</span></div>
      <div className="card-sub">{g} avg{pts.length ? ` · ${pts[pts.length - 1].d}` : ''}</div>
      <MetricChart points={pts} granularity={g} color={color} label={label} />
      <div className="card-foot" role="group" aria-label={`${label} chart range`}>
        {(['monthly', 'weekly'] as const).map((k) => (
          <button key={k} className={k === g ? 'tg on' : 'tg'} aria-pressed={k === g} onClick={() => setG(k)}>{k}</button>
        ))}
      </div>
    </div>
  );
}

export default function ActivityTrend({ snap }: { snap: Snapshot }) {
  if (!snap.activity || !snap.activity.length) return null;
  const monthly = group(snap, (d) => d.slice(0, 7));
  const weekly = group(snap, (d) => isoWeek(d));
  const series = (key: 'move' | 'exer' | 'stand'): { monthly: Pt[]; weekly: Pt[] } => ({
    monthly: monthly.map((o) => ({ d: o.d, v: o[key] })),
    weekly: weekly.map((o) => ({ d: o.d, v: o[key] })),
  });
  return (
    <section>
      <h2 className="sec">Activity trend</h2>
      <div className="grid">
        <Card label="Move" unit="kcal/day" {...series('move')} color="#ff5a6e" />
        <Card label="Exercise" unit="min/day" {...series('exer')} color="#36d39a" />
        <Card label="Stand" unit="h/day" {...series('stand')} color="#46a6ff" />
      </div>
    </section>
  );
}
