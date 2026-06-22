// Mapping from Apple HealthKit type identifiers -> HealthLens metrics, plus the
// aggregation rule and unit normalization each metric requires.
//
// Aggregation kinds (discovered from the real export):
//  - 'point'  : a measurement (weight, BMI, HR, HRV). Average per day; latest = newest reading.
//  - 'sum'    : a cumulative count emitted in sub-daily increments (steps, active energy).
//               Multiple sources (iPhone + Watch) overlap, so sum PER SOURCE then take the
//               dominant source per bucket — never blind-sum across sources.
//  - 'sleep'  : a category record; value is a stage string, "hours" is the interval duration.
//               Only Asleep* stages count; bucket by wake date.

import type { Metric } from './types';

export type AggKind = 'point' | 'sum' | 'sleep';

export interface MetricDef {
  metric: Metric;
  agg: AggKind;
  canonicalUnit: string;
  /** Convert a raw (value, unit) pair to the canonical unit. */
  toCanonical: (value: number, unit: string) => number;
}

const LB_TO_KG = 0.45359237;
const KJ_TO_KCAL = 1 / 4.184;

const kgFrom = (v: number, u: string) =>
  u.toLowerCase() === 'lb' ? v * LB_TO_KG : v;

export const HK_MAP: Readonly<{ [id: string]: MetricDef }> = {
  HKQuantityTypeIdentifierBodyMass: {
    metric: 'weight',
    agg: 'point',
    canonicalUnit: 'kg',
    toCanonical: kgFrom,
  },
  HKQuantityTypeIdentifierBodyFatPercentage: {
    metric: 'bodyFatPct',
    agg: 'point',
    canonicalUnit: '%',
    // Apple stores body fat as a FRACTION (0.188) despite unit="%". Scale to percent.
    toCanonical: (v) => (v <= 1 ? v * 100 : v),
  },
  HKQuantityTypeIdentifierBodyMassIndex: {
    metric: 'bmi',
    agg: 'point',
    canonicalUnit: '',
    toCanonical: (v) => v,
  },
  HKQuantityTypeIdentifierLeanBodyMass: {
    metric: 'leanMass',
    agg: 'point',
    canonicalUnit: 'kg',
    toCanonical: kgFrom,
  },
  HKQuantityTypeIdentifierRestingHeartRate: {
    metric: 'restingHR',
    agg: 'point',
    canonicalUnit: 'bpm',
    toCanonical: (v) => v,
  },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: {
    metric: 'hrv',
    agg: 'point',
    canonicalUnit: 'ms',
    toCanonical: (v) => v,
  },
  HKQuantityTypeIdentifierHeartRate: {
    metric: 'heartRate',
    agg: 'point',
    canonicalUnit: 'bpm',
    toCanonical: (v) => v,
  },
  HKQuantityTypeIdentifierWalkingHeartRateAverage: {
    metric: 'walkingHR',
    agg: 'point',
    canonicalUnit: 'bpm',
    toCanonical: (v) => v,
  },
  HKQuantityTypeIdentifierHeartRateRecoveryOneMinute: {
    metric: 'hrRecovery',
    agg: 'point',
    canonicalUnit: 'bpm',
    toCanonical: (v) => v,
  },
  HKQuantityTypeIdentifierVO2Max: {
    metric: 'vo2max',
    agg: 'point',
    canonicalUnit: 'mL/kg·min',
    toCanonical: (v) => v,
  },
  HKQuantityTypeIdentifierOxygenSaturation: {
    metric: 'spo2',
    agg: 'point',
    canonicalUnit: '%',
    // stored as a fraction (0.96) despite unit="%" — scale to percent
    toCanonical: (v) => (v <= 1 ? v * 100 : v),
  },
  HKQuantityTypeIdentifierRespiratoryRate: {
    metric: 'respRate',
    agg: 'point',
    canonicalUnit: 'br/min',
    toCanonical: (v) => v,
  },
  HKQuantityTypeIdentifierStepCount: {
    metric: 'steps',
    agg: 'sum',
    canonicalUnit: 'count',
    toCanonical: (v) => v,
  },
  HKQuantityTypeIdentifierActiveEnergyBurned: {
    metric: 'activeEnergy',
    agg: 'sum',
    canonicalUnit: 'kcal',
    toCanonical: (v, u) => (u === 'kJ' ? v * KJ_TO_KCAL : v),
  },
  HKCategoryTypeIdentifierSleepAnalysis: {
    metric: 'sleepHours',
    agg: 'sleep',
    canonicalUnit: 'h',
    toCanonical: (v) => v, // value is computed (hours) before this is applied
  },
};

/** Sleep category values that count as actual sleep (exclude InBed / Awake). */
export function isAsleepStage(categoryValue: string): boolean {
  return categoryValue.startsWith('HKCategoryValueSleepAnalysisAsleep');
}

/** A sleep segment starting within daytime hours is treated as a nap. */
export const NAP_START_HOUR = 11; // inclusive
export const NAP_END_HOUR = 19; // exclusive
export function isNapStart(hour: number): boolean {
  return hour >= NAP_START_HOUR && hour < NAP_END_HOUR;
}

/** Prettify an HKWorkoutActivityType into a human label. */
export function workoutLabel(activityType: string): string {
  return activityType
    .replace('HKWorkoutActivityType', '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

/** Plausible canonical-unit ranges used by the validation step (not hard limits). */
export const PLAUSIBLE_RANGE: { [K in Metric]: [number, number] } = {
  weight: [20, 400], // kg
  bodyFatPct: [2, 70], // %
  bmi: [8, 90],
  leanMass: [10, 200], // kg
  restingHR: [25, 150], // bpm
  hrv: [1, 400], // ms
  heartRate: [25, 230], // bpm (instantaneous)
  walkingHR: [40, 180], // bpm
  hrRecovery: [5, 120], // bpm drop in 1 min
  vo2max: [10, 90], // mL/kg·min
  spo2: [70, 100], // %
  respRate: [4, 45], // breaths/min
  steps: [0, 200000], // per day
  sleepHours: [0, 24], // per night
  napHours: [0, 8], // per day
  activeEnergy: [0, 15000], // kcal/day
};
