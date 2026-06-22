// HealthLens shared domain types.
// The schema is intentionally tiny and stable: raw Apple Health records are
// normalized to `Record`, then pre-aggregated to `Rollup`. The AI insight
// component reads ONLY rollups — never raw records — for token efficiency.

/** Canonical metric keys used across the app. */
export const METRICS = [
  'weight',
  'bodyFatPct',
  'bmi',
  'leanMass',
  'restingHR',
  'hrv',
  'heartRate',
  'walkingHR',
  'hrRecovery',
  'vo2max',
  'spo2',
  'respRate',
  'steps',
  'sleepHours',
  'napHours',
  'activeEnergy',
] as const;

export type Metric = (typeof METRICS)[number];

/** Simplified public subset shipped in Version B. */
export const METRICS_PUBLIC: Metric[] = [
  'weight',
  'bodyFatPct',
  'steps',
  'restingHR',
  'sleepHours',
];

/** Human-readable labels + canonical display units (presentation only). */
// NOTE: domain interface `Record` (below) shadows TS's built-in Record<K,V>,
// so we use an explicit mapped type here instead of `Record<Metric, ...>`.
export const METRIC_META: { [K in Metric]: { label: string; unit: string } } = {
  weight: { label: 'Weight', unit: 'kg' },
  bodyFatPct: { label: 'Body Fat', unit: '%' },
  bmi: { label: 'BMI', unit: '' },
  leanMass: { label: 'Lean Mass', unit: 'kg' },
  restingHR: { label: 'Resting HR', unit: 'bpm' },
  hrv: { label: 'HRV', unit: 'ms' },
  heartRate: { label: 'Heart Rate', unit: 'bpm' },
  walkingHR: { label: 'Walking HR', unit: 'bpm' },
  hrRecovery: { label: 'HR Recovery', unit: 'bpm' },
  vo2max: { label: 'VO₂ Max', unit: 'mL/kg·min' },
  spo2: { label: 'Blood Oxygen', unit: '%' },
  respRate: { label: 'Respiratory Rate', unit: 'br/min' },
  steps: { label: 'Steps', unit: 'count' },
  sleepHours: { label: 'Sleep', unit: 'h' },
  napHours: { label: 'Naps', unit: 'h' },
  activeEnergy: { label: 'Active Energy', unit: 'kcal' },
};

/** A single normalized observation. `date` is an ISO date (YYYY-MM-DD). */
export interface Record {
  date: string;
  metric: Metric;
  value: number;
  unit: string;
  source: string;
}

export type Period = 'daily' | 'weekly';
export type TrendDir = 'up' | 'down' | 'flat';

/** Pre-aggregated summary the AI reads instead of raw data. */
export interface Rollup {
  metric: Metric;
  period: Period;
  /** Bucket key: 'YYYY-MM-DD' for daily, 'YYYY-Www' for weekly. */
  bucket: string;
  min: number;
  max: number;
  avg: number;
  latest: number;
  trendDir: TrendDir;
  sampleCount: number;
}

/** Daily Apple activity-ring summary (from <ActivitySummary>). */
export interface ActivityDay {
  date: string;
  moveKcal: number;
  moveGoal: number;
  exerciseMin: number;
  exerciseGoal: number;
  standHours: number;
  standGoal: number;
}

/** Per-exercise-type workout aggregate (from <Workout>). */
export interface WorkoutTypeAgg {
  type: string;
  label: string;
  count: number;
  totalMin: number;
  totalKcal: number;
}

export interface WorkoutRecent {
  date: string;
  type: string;
  label: string;
  min: number;
  kcal: number;
}

export interface WorkoutSummary {
  totalCount: number;
  totalMin: number;
  totalKcal: number;
  byType: WorkoutTypeAgg[];
  recent: WorkoutRecent[];
}

/** The single "latest" snapshot written by the ingest loop. */
export interface Snapshot {
  generatedAt: string;
  sourceZip: string;
  /** Most recent value per metric. */
  latest: Partial<Record>[];
  rollups: Rollup[];
  /** Apple activity rings per day (most recent last). */
  activity?: ActivityDay[];
  /** Workout log aggregates. */
  workouts?: WorkoutSummary;
}
