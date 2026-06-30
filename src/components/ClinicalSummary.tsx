'use client';

// One-page, doctor-oriented summary of patient-generated wearable data.
// Built entirely client-side; copy-as-text or print/Save-PDF. Descriptive only —
// "general reference ranges", no diagnosis, no recommendations.

import { useState } from 'react';
import type { Metric, Snapshot } from '@/lib/types';
import { METRIC_META } from '@/lib/types';
import { buildView } from '@/lib/view';
import type { Focus } from '@/lib/focus';

const DEFAULT_METRICS: Metric[] = [
  'weight', 'bmi', 'bodyFatPct', 'restingHR', 'hrv', 'vo2max', 'spo2', 'respRate', 'sleepHours',
];

function fmt(n: number | null) {
  return n == null ? '—' : n.toLocaleString();
}
function deltaStr(d: number | null) {
  if (d == null) return '—';
  const s = d > 0 ? '+' : '';
  return `${s}${d}`;
}

export default function ClinicalSummary({ snap, focus }: { snap: Snapshot; focus: Focus }) {
  const [copied, setCopied] = useState(false);

  // data span from daily rollups
  const days = snap.rollups.filter((r) => r.period === 'daily').map((r) => r.bucket).sort();
  const span = days.length ? `${days[0]} to ${days[days.length - 1]}` : 'n/a';

  const metrics = (focus.priority.length ? focus.priority : DEFAULT_METRICS).filter(
    (m, i, a) => a.indexOf(m) === i,
  );
  const rows = metrics.map((m) => ({ m, v: buildView(snap, m) })).filter((r) => r.v.head != null);

  // activity vs guideline (Apple "exercise minutes" ≈ MVPA)
  const act = snap.activity || [];
  const recentAct = act.slice(-90);
  const exMinDay = recentAct.length ? recentAct.reduce((s, a) => s + a.exerciseMin, 0) / recentAct.length : null;
  const exMinWk = exMinDay == null ? null : Math.round(exMinDay * 7);
  const steps = buildView(snap, 'steps').head;
  const activeEnergy = buildView(snap, 'activeEnergy').head;

  const w = snap.workouts;

  // notable changes: largest relative moves among the shown metrics
  const movers = rows
    .filter((r) => r.v.prior != null && r.v.delta != null && r.v.prior !== 0)
    .map((r) => ({ label: r.v.label, unit: r.v.unit, delta: r.v.delta!, pct: Math.round((r.v.delta! / r.v.prior!) * 100) }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
    .slice(0, 4);

  function asText() {
    const L: string[] = [];
    L.push('HEALTHLENS — PATIENT-GENERATED WEARABLE DATA SUMMARY');
    L.push('Patient-generated data from Apple Health. NOT a medical device; not diagnostic. General reference ranges only.');
    L.push(`Data span: ${span}  |  Focus: ${focus.label}  |  Generated: ${snap.generatedAt.slice(0, 10)}`);
    L.push('');
    L.push('KEY METRICS (recent 90-day avg vs prior 90 days; normal band = your own p25–p75):');
    rows.forEach((r) => {
      const v = r.v;
      const u = v.unit;
      const band = v.band ? `${v.band.lo}–${v.band.hi} ${u}` : 'n/a';
      const prior = v.prior == null ? 'n/a' : `${fmt(v.prior)} ${u}`;
      const d = v.delta == null ? 'n/a' : `${deltaStr(v.delta)} ${u}`;
      L.push(`  ${v.label}: ${fmt(v.head)} ${u}  (prior ${prior}, Δ ${d})  band ${band}  [${v.trend}]`);
    });
    L.push('');
    L.push('ACTIVITY:');
    L.push(`  Exercise minutes/week: ${exMinWk ?? 'n/a'} (general guideline ≈ 150)`);
    L.push(`  Steps/day: ${fmt(steps)}   Active energy/day: ${fmt(activeEnergy)} kcal`);
    if (w && w.totalCount) {
      L.push('');
      L.push(`WORKOUTS: ${w.totalCount} sessions, ${w.totalMin.toLocaleString()} min, ${w.totalKm.toLocaleString()} km`);
      w.byType.slice(0, 5).forEach((t) => L.push(`  ${t.label}: ${t.count}× · ${t.totalMin} min${t.totalKm > 0 ? ` · ${t.totalKm} km` : ''}`));
    }
    if (movers.length) {
      L.push('');
      L.push('NOTABLE CHANGES (vs prior 90 days):');
      movers.forEach((m) => L.push(`  ${m.label}: ${deltaStr(m.delta)} ${m.unit} (${m.pct > 0 ? '+' : ''}${m.pct}%)`));
    }
    L.push('');
    L.push('Source: consumer wearable (Apple Health). Values are approximations for discussion, not clinical measurements.');
    return L.join('\n');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function printSummary() {
    document.body.classList.add('print-summary');
    const cleanup = () => {
      document.body.classList.remove('print-summary');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 1000); // fallback if afterprint doesn't fire
  }

  return (
    <section className="summary">
      <div className="summary-head">
        <h2 className="sec" style={{ margin: 0 }}>Clinical summary (for your doctor)</h2>
        <div className="summary-actions">
          <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy as text'}</button>
          <button onClick={printSummary}>Print / Save as PDF</button>
        </div>
      </div>
      <p className="summary-meta">
        Patient-generated data · {span} · <strong>Focus: {focus.label}</strong> · <strong>not a medical device, not diagnostic</strong>
      </p>

      <table className="summary-table">
        <thead>
          <tr><th>Metric</th><th>Recent (90d)</th><th>Prior (90d)</th><th>Δ</th><th>Normal band</th><th>Trend</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.m}>
              <td>{r.v.label}</td>
              <td>{fmt(r.v.head)} {r.v.unit}</td>
              <td>{r.v.prior == null ? '—' : `${fmt(r.v.prior)} ${r.v.unit}`}</td>
              <td>{r.v.delta == null ? '—' : `${deltaStr(r.v.delta)} ${r.v.unit}`}</td>
              <td>{r.v.band ? `${r.v.band.lo}–${r.v.band.hi} ${r.v.unit}` : '—'}</td>
              <td>{r.v.trend}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="summary-cols">
        <div>
          <h3>Activity</h3>
          <p>Exercise: <strong>{exMinWk ?? '—'} min/week</strong> <span className="muted">(guideline ≈ 150)</span></p>
          <p>Steps/day: <strong>{fmt(steps)}</strong> · Active energy/day: <strong>{fmt(activeEnergy)}</strong> kcal</p>
        </div>
        {w && w.totalCount > 0 && (
          <div>
            <h3>Workouts</h3>
            <p>{w.totalCount} sessions · {w.totalMin.toLocaleString()} min · {w.totalKm.toLocaleString()} km</p>
            <p className="muted">{w.byType.slice(0, 4).map((t) => `${t.label} ${t.count}×`).join(' · ')}</p>
          </div>
        )}
        {movers.length > 0 && (
          <div>
            <h3>Notable changes</h3>
            {movers.map((m) => (
              <p key={m.label}>{m.label}: <strong>{deltaStr(m.delta)} {m.unit}</strong> <span className="muted">({m.pct > 0 ? '+' : ''}{m.pct}%)</span></p>
            ))}
          </div>
        )}
      </div>
      <p className="summary-foot">
        Source: consumer wearable (Apple Health). Normal band = the patient&rsquo;s own p25–p75 over the period, not a
        clinical reference interval. Approximations for discussion only.
      </p>
    </section>
  );
}
