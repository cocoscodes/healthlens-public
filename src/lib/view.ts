// Build a chart-ready view for a metric from a Snapshot: daily/weekly/monthly
// series + a robust trailing-90-day headline (fallback: last 5 readings).
// Mirrors the Version A static export so both versions behave identically.

import type { Metric, Snapshot, TrendDir } from './types';
import { METRIC_META } from './types';

const ADDITIVE = new Set<Metric>(['steps', 'activeEnergy', 'sleepHours', 'napHours']);
const round = (n: number) => Math.round(n * 100) / 100;

export interface Pt {
  d: string;
  v: number;
}
export interface MetricView {
  metric: Metric;
  label: string;
  unit: string;
  head: number | null;
  headKind: string;
  headDate: string | null;
  trend: TrendDir;
  sparse: boolean;
  count: number;
  defView: 'monthly' | 'weekly' | 'daily';
  daily: Pt[];
  weekly: Pt[];
  monthly: Pt[];
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function monthlyFrom(pts: Pt[]): Pt[] {
  const m = new Map<string, { s: number; n: number }>();
  for (const p of pts) {
    const k = p.d.slice(0, 7);
    const a = m.get(k) ?? { s: 0, n: 0 };
    a.s += p.v;
    a.n++;
    m.set(k, a);
  }
  return [...m.entries()].sort().map(([k, a]) => ({ d: k, v: round(a.s / a.n) }));
}

export function buildView(snap: Snapshot, metric: Metric): MetricView {
  const add = ADDITIVE.has(metric);
  const daily = snap.rollups
    .filter((r) => r.metric === metric && r.period === 'daily')
    .sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
  const weekly = snap.rollups
    .filter((r) => r.metric === metric && r.period === 'weekly')
    .sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
  const dPts: Pt[] = daily.map((r) => ({ d: r.bucket, v: add ? r.latest : r.avg }));
  const wPts: Pt[] = weekly.map((r) => ({ d: r.bucket, v: r.avg }));
  const mPts = monthlyFrom(dPts);

  let head: number | null = null;
  let headDate: string | null = null;
  let trend: TrendDir = 'flat';
  if (dPts.length) {
    const lastD = dPts[dPts.length - 1].d;
    const cut = addDays(lastD, -90);
    const cut2 = addDays(lastD, -180);
    let rec = dPts.filter((p) => p.d >= cut);
    if (rec.length < 5) rec = dPts.slice(-5);
    const prev = dPts.filter((p) => p.d >= cut2 && p.d < cut);
    head = round(rec.reduce((s, p) => s + p.v, 0) / rec.length);
    headDate = lastD;
    if (prev.length) {
      const pv = prev.reduce((s, p) => s + p.v, 0) / prev.length;
      const th = Math.abs(pv) * 0.02;
      trend = head > pv + th ? 'up' : head < pv - th ? 'down' : 'flat';
    }
  }

  return {
    metric,
    label: METRIC_META[metric].label,
    unit: METRIC_META[metric].unit,
    head,
    headKind: add ? 'recent avg/day (90d)' : 'recent avg (90d)',
    headDate,
    trend,
    sparse: daily.length < 30,
    count: daily.length,
    defView: mPts.length >= 3 ? 'monthly' : wPts.length >= 3 ? 'weekly' : 'daily',
    daily: dPts,
    weekly: wPts,
    monthly: mPts,
  };
}
