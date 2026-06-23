// Patient-type "focus" presets. These ONLY reorder/prioritize which metrics are
// surfaced first — they do not diagnose, score, or recommend. The relevant
// metrics are patient-selected and framed as general, educational reference.

import type { Metric } from './types';

export interface Focus {
  id: string;
  label: string;
  /** One-line, non-diagnostic description of what this view emphasizes. */
  blurb: string;
  /** Metrics to surface first, in priority order. Empty = default full layout. */
  priority: Metric[];
}

export const FOCI: Focus[] = [
  {
    id: 'general',
    label: 'General',
    blurb: 'The full dashboard, in the standard order.',
    priority: [],
  },
  {
    id: 'metabolic',
    label: 'Metabolic / weight',
    blurb:
      'Metrics commonly discussed around metabolic health and weight management — general reference only, not a screen or diagnosis.',
    priority: ['weight', 'bmi', 'bodyFatPct', 'activeEnergy', 'steps', 'vo2max', 'sleepHours', 'restingHR'],
  },
  {
    id: 'cardio',
    label: 'Blood pressure / cardiac',
    blurb:
      'Cardiovascular and autonomic metrics often reviewed in blood-pressure and heart contexts. If a blood-pressure cuff is connected, those readings appear too. General reference only.',
    priority: ['restingHR', 'hrv', 'heartRate', 'walkingHR', 'hrRecovery', 'spo2', 'sleepHours', 'steps'],
  },
  {
    id: 'fitness',
    label: 'Fitness / performance',
    blurb: 'Cardiorespiratory fitness and training-response metrics.',
    priority: ['vo2max', 'hrRecovery', 'restingHR', 'hrv', 'steps', 'activeEnergy'],
  },
  {
    id: 'sleep',
    label: 'Sleep / recovery',
    blurb: 'Sleep duration and overnight physiology often discussed around rest and recovery.',
    priority: ['sleepHours', 'napHours', 'hrv', 'restingHR', 'respRate', 'spo2'],
  },
];

export function getFocus(id: string): Focus {
  return FOCI.find((f) => f.id === id) || FOCI[0];
}
