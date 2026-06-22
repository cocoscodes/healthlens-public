// Synthetic sample snapshot for the public demo — NOT real data. Generates a
// year of plausible values for the public metric subset, then runs them through
// the same Aggregator the real upload uses, so the demo behaves identically.

import { Aggregator } from './aggregator';
import { METRIC_META, METRICS_PUBLIC } from './types';
import type { Snapshot, Metric } from './types';
import type { ParsedRecord } from './parser';

// deterministic RNG so the demo is stable across reloads
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Spec {
  metric: Metric;
  agg: ParsedRecord['agg'];
  unit: string;
  base: number;
  drift: number; // total change across the year
  noise: number;
  gapProb?: number; // chance a day has no reading (sparse)
}

const SPECS: Spec[] = [
  { metric: 'weight', agg: 'point', unit: 'kg', base: 78, drift: -4, noise: 0.4, gapProb: 0.7 },
  { metric: 'bodyFatPct', agg: 'point', unit: '%', base: 22, drift: -3, noise: 0.5, gapProb: 0.7 },
  { metric: 'restingHR', agg: 'point', unit: 'bpm', base: 62, drift: -4, noise: 2.5 },
  { metric: 'steps', agg: 'sum', unit: 'count', base: 8200, drift: 1500, noise: 2600 },
  { metric: 'sleepHours', agg: 'sleep', unit: 'h', base: 6.6, drift: 0.4, noise: 0.9 },
];

export function sampleSnapshot(days = 365): Snapshot {
  const agg = new Aggregator();
  const rand = rng(20260622);
  const today = new Date();
  for (const spec of SPECS) {
    for (let i = days - 1; i >= 0; i--) {
      if (spec.gapProb && rand() < spec.gapProb) continue;
      const dt = new Date(today);
      dt.setDate(today.getDate() - i);
      const date = dt.toISOString().slice(0, 10);
      const progress = (days - i) / days;
      const seasonal = Math.sin(progress * Math.PI * 2) * spec.noise * 0.4;
      const value = Math.max(
        0,
        spec.base + spec.drift * progress + seasonal + (rand() - 0.5) * 2 * spec.noise,
      );
      const ts = dt.getTime() + 8 * 3600_000; // mid-morning
      const rec: ParsedRecord = {
        date,
        metric: spec.metric,
        value: spec.metric === 'steps' ? Math.round(value) : Math.round(value * 100) / 100,
        unit: spec.unit,
        source: 'Sample',
        ts,
        agg: spec.agg,
      };
      agg.add(rec);
    }
  }
  const rollups = agg.finalize();
  const latest: Snapshot['latest'] = [];
  for (const metric of METRICS_PUBLIC) {
    const daily = rollups
      .filter((r) => r.metric === metric && r.period === 'daily')
      .sort((a, b) => (a.bucket < b.bucket ? 1 : -1));
    if (daily.length) latest.push({ date: daily[0].bucket, metric, value: daily[0].latest, unit: METRIC_META[metric].unit });
  }
  return { generatedAt: new Date().toISOString(), sourceZip: 'sample-data', latest, rollups };
}
