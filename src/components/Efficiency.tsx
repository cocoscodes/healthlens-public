'use client';

import type { Snapshot, WorkoutEffMonth } from '@/lib/types';
import MetricChart from './MetricChart';

export default function Efficiency({ snap }: { snap: Snapshot }) {
  const eff = snap.workouts?.efficiency || [];
  if (!eff.length) return null;
  const byType: Record<string, { label: string; months: WorkoutEffMonth[] }> = {};
  for (const e of eff) (byType[e.type] = byType[e.type] || { label: e.label, months: [] }).months.push(e);
  const types = Object.values(byType).filter((t) => t.months.filter((m) => m.aeroEff > 0).length >= 3);
  if (!types.length) return null;

  return (
    <section>
      <h2 className="sec">Fitness efficiency</h2>
      <p className="recnote" style={{ marginTop: -4, marginBottom: 10 }}>
        Aerobic efficiency = pace ÷ heart rate. Track each activity against itself over time — the
        index is <strong>not comparable across activities</strong> (cycling covers more distance per
        heartbeat than running).
      </p>
      <div className="grid">
        {types.map((t) => {
          const pts = t.months.filter((m) => m.aeroEff > 0).map((m) => ({ d: m.month, v: m.aeroEff }));
          const last = t.months[t.months.length - 1];
          return (
            <div className="card" key={t.label}>
              <div className="card-head">
                <span className="card-label">{t.label}</span>
              </div>
              <div className="card-value">
                {pts[pts.length - 1].v}
                <span className="card-unit">idx</span>
              </div>
              <div className="card-sub">
                pace÷HR ×1000 · higher = fitter · {last.paceKmh} km/h @ {last.hrAvg} bpm
              </div>
              <MetricChart points={pts} granularity="monthly" color="#36d39a" />
            </div>
          );
        })}
      </div>
    </section>
  );
}
