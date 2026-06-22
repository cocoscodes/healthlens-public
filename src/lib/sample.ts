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
  // body composition (sparse — periodic weigh-ins)
  { metric: 'weight', agg: 'point', unit: 'kg', base: 78, drift: -4, noise: 0.4, gapProb: 0.75 },
  { metric: 'bodyFatPct', agg: 'point', unit: '%', base: 22, drift: -3, noise: 0.5, gapProb: 0.75 },
  { metric: 'bmi', agg: 'point', unit: '', base: 24.6, drift: -1, noise: 0.2, gapProb: 0.75 },
  { metric: 'leanMass', agg: 'point', unit: 'kg', base: 58, drift: 1.2, noise: 0.4, gapProb: 0.75 },
  // heart & lungs
  { metric: 'restingHR', agg: 'point', unit: 'bpm', base: 62, drift: -4, noise: 2.5 },
  { metric: 'heartRate', agg: 'point', unit: 'bpm', base: 78, drift: -3, noise: 6 },
  { metric: 'walkingHR', agg: 'point', unit: 'bpm', base: 118, drift: -4, noise: 5 },
  { metric: 'hrRecovery', agg: 'point', unit: 'bpm', base: 28, drift: 6, noise: 4, gapProb: 0.4 },
  { metric: 'hrv', agg: 'point', unit: 'ms', base: 48, drift: 8, noise: 6 },
  { metric: 'vo2max', agg: 'point', unit: 'mL/kg·min', base: 42, drift: 3, noise: 1.4, gapProb: 0.6 },
  { metric: 'spo2', agg: 'point', unit: '%', base: 97, drift: 0, noise: 0.8 },
  { metric: 'respRate', agg: 'point', unit: 'br/min', base: 15, drift: 0, noise: 1.4 },
  // activity totals
  { metric: 'steps', agg: 'sum', unit: 'count', base: 8200, drift: 1500, noise: 2600 },
  { metric: 'activeEnergy', agg: 'sum', unit: 'kcal', base: 600, drift: 90, noise: 180 },
  // sleep
  { metric: 'sleepHours', agg: 'sleep', unit: 'h', base: 6.6, drift: 0.4, noise: 0.9 },
  { metric: 'napHours', agg: 'sleep', unit: 'h', base: 0.7, drift: 0, noise: 0.5, gapProb: 0.6 },
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
  // synthetic workouts: [type, label, kmPerMin (0 = no distance), baseHR]
  const WK: [string, string, number, number][] = [
    ['HKWorkoutActivityTypeRunning', 'Running', 0.16, 142],
    ['HKWorkoutActivityTypeCycling', 'Cycling', 0.42, 132],
    ['HKWorkoutActivityTypeWalking', 'Walking', 0.09, 108],
    ['HKWorkoutActivityTypeSwimming', 'Swimming', 0.03, 138],
    ['HKWorkoutActivityTypeFunctionalStrengthTraining', 'Functional Strength Training', 0, 120],
    ['HKWorkoutActivityTypeYoga', 'Yoga', 0, 92],
  ];
  for (let i = days - 1; i >= 0; i--) {
    if (rand() < 0.45) continue; // ~4 workouts/week
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    const [type, label, kmPerMin, baseHR] = WK[Math.floor(rand() * WK.length)];
    const min = Math.round(20 + rand() * 60);
    const progress = (days - i) / days;
    agg.addWorkout({
      date: dt.toISOString().slice(0, 10),
      type,
      label,
      min,
      kcal: Math.round(min * (6 + rand() * 6)),
      km: kmPerMin ? Math.round(min * kmPerMin * (1 + progress * 0.12) * 100) / 100 : 0,
      hrAvg: Math.round(baseHR - progress * 5 + (rand() - 0.5) * 8), // fitness drift: HR down over time
    });
  }

  // synthetic activity rings (Move / Exercise / Stand) — one per day
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(today.getDate() - i);
    const progress = (days - i) / days;
    agg.addActivity({
      date: dt.toISOString().slice(0, 10),
      moveKcal: Math.max(0, Math.round(560 + progress * 120 + (rand() - 0.5) * 320)),
      moveGoal: 650,
      exerciseMin: Math.max(0, Math.round(32 + progress * 12 + (rand() - 0.5) * 26)),
      exerciseGoal: 30,
      standHours: Math.min(16, Math.max(0, Math.round(12 + (rand() - 0.5) * 5))),
      standGoal: 12,
    });
  }

  const rollups = agg.finalize();
  const extras = agg.finalizeExtras();
  const latest: Snapshot['latest'] = [];
  for (const metric of METRICS_PUBLIC) {
    const daily = rollups
      .filter((r) => r.metric === metric && r.period === 'daily')
      .sort((a, b) => (a.bucket < b.bucket ? 1 : -1));
    if (daily.length) latest.push({ date: daily[0].bucket, metric, value: daily[0].latest, unit: METRIC_META[metric].unit });
  }
  return {
    generatedAt: new Date().toISOString(),
    sourceZip: 'sample-data',
    latest,
    rollups,
    activity: extras.activity,
    workouts: extras.workouts,
  };
}
