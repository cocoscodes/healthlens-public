// Pure, testable parsing logic for Apple Health export.xml records.
// No I/O here — the streaming/zip plumbing lives in scripts/ingest.ts so this
// module can be unit-tested on small in-memory samples.

import type { Metric } from './types';
import { HK_MAP, isAsleepStage, isNapStart, workoutLabel, type AggKind } from './metrics';
import type { ActivityDay, WorkoutRecent } from './types';
// (sleepNightDate / addDays are defined below and used in normalizeRecord)

/** A normalized record plus the fields the aggregator needs (ts, agg). */
export interface ParsedRecord {
  date: string; // local calendar date YYYY-MM-DD (bucket key basis)
  metric: Metric;
  value: number; // canonical unit
  unit: string;
  source: string;
  ts: number; // absolute ms (UTC) — for ordering & durations
  agg: AggKind;
}

const APPLE_DATE =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/;

/**
 * Parse Apple's "YYYY-MM-DD HH:MM:SS ±HHMM" timestamp.
 * Returns the LOCAL calendar date (for bucketing) and the absolute UTC ms
 * (for ordering and duration math — the offset cancels in differences).
 */
export function parseAppleDate(
  s: string | undefined,
): { localDate: string; ts: number; hour: number } | null {
  if (!s) return null;
  const m = APPLE_DATE.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss, sign, oh, om] = m;
  const localDate = `${y}-${mo}-${d}`;
  const utcMs = Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss);
  const offsetMs = (sign === '-' ? -1 : 1) * (+oh * 60 + +om) * 60_000;
  // Local wall-clock minus its offset = UTC instant.
  return { localDate, ts: utcMs - offsetMs, hour: +hh };
}

/** Add `n` days to a YYYY-MM-DD string (UTC-safe, no tz drift). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/**
 * Assign a sleep segment to a single "night", labeled by the wake-up day.
 * Segments starting at/after 18:00 local roll to the next calendar day, so a
 * 22:00–08:00 sleep (split across midnight into many stage segments) all lands
 * in one bucket instead of being torn across two dates.
 */
export function sleepNightDate(startLocalDate: string, startHour: number): string {
  return startHour >= 18 ? addDays(startLocalDate, 1) : startLocalDate;
}

const ENTITIES: { [k: string]: string } = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function decode(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => ENTITIES[m] ?? m);
}

const ATTR_RE = /([:\w-]+)="([^"]*)"/g;

/** Extract attributes from a single element tag string. */
export function parseAttrs(tag: string): { [k: string]: string } {
  const out: { [k: string]: string } = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(tag))) {
    out[m[1]] = decode(m[2]);
  }
  return out;
}

/**
 * Normalize one set of Record attributes to a ParsedRecord, or null if the
 * record isn't a tracked metric / lacks a usable value.
 */
export function normalizeRecord(attrs: {
  [k: string]: string;
}): ParsedRecord | null {
  const def = HK_MAP[attrs.type];
  if (!def) return null;
  const source = attrs.sourceName || 'unknown';

  if (def.agg === 'sleep') {
    if (!attrs.value || !isAsleepStage(attrs.value)) return null;
    const start = parseAppleDate(attrs.startDate);
    const end = parseAppleDate(attrs.endDate);
    if (!start || !end) return null;
    const hours = (end.ts - start.ts) / 3_600_000;
    if (!(hours > 0) || hours > 24) return null; // guard against bad intervals
    // Daytime segments are naps (separate metric); otherwise nocturnal sleep
    // attributed to one wake-day bucket (6pm-anchored).
    const nap = isNapStart(start.hour);
    return {
      date: nap ? start.localDate : sleepNightDate(start.localDate, start.hour),
      metric: nap ? 'napHours' : 'sleepHours',
      value: hours,
      unit: 'h',
      source,
      ts: end.ts,
      agg: 'sleep',
    };
  }

  // point / sum metrics
  if (attrs.value == null || attrs.value === '') return null;
  const raw = Number.parseFloat(attrs.value);
  if (!Number.isFinite(raw)) return null;
  const unit = attrs.unit || def.canonicalUnit;
  const start = parseAppleDate(attrs.startDate);
  if (!start) return null;
  return {
    date: start.localDate,
    metric: def.metric,
    value: def.toCanonical(raw, unit),
    unit: def.canonicalUnit,
    source,
    ts: start.ts,
    agg: def.agg,
  };
}

/** Convenience for tests: parse a raw "<Record .../>" tag straight to a record. */
export function parseRecordTag(tag: string): ParsedRecord | null {
  return normalizeRecord(parseAttrs(tag));
}

/** Parse a <Workout> element into a workout record (type, duration, calories). */
export function parseWorkout(attrs: { [k: string]: string }): WorkoutRecent | null {
  const type = attrs.workoutActivityType;
  if (!type) return null;
  const start = parseAppleDate(attrs.startDate);
  if (!start) return null;
  let min = Number.parseFloat(attrs.duration);
  if (!Number.isFinite(min)) min = 0;
  if (attrs.durationUnit && attrs.durationUnit !== 'min') {
    if (attrs.durationUnit === 'sec') min = min / 60;
    else if (attrs.durationUnit === 'hr') min = min * 60;
  }
  // Modern exports may omit totalEnergyBurned / totalDistance (they move to
  // WorkoutStatistics children — see WorkoutCollector below).
  let kcal = Number.parseFloat(attrs.totalEnergyBurned);
  if (!Number.isFinite(kcal)) kcal = 0;
  if (attrs.totalEnergyBurnedUnit === 'kJ') kcal = kcal / 4.184;
  let km = Number.parseFloat(attrs.totalDistance);
  km = Number.isFinite(km) ? toKm(km, attrs.totalDistanceUnit) : 0;
  return {
    date: start.localDate,
    type,
    label: workoutLabel(type),
    min: Math.round(min * 10) / 10,
    kcal: Math.round(kcal),
    km: Math.round(km * 100) / 100,
    hrAvg: 0, // filled from the HeartRate WorkoutStatistic by WorkoutCollector
  };
}

/** Convert a distance to kilometres. Apple exports km here, but be defensive. */
export function toKm(v: number, unit?: string): number {
  if (!unit || unit === 'km') return v;
  if (unit === 'mi') return v * 1.609344;
  if (unit === 'm') return v / 1000;
  if (unit === 'yd') return v * 0.0009144;
  return v;
}

/**
 * Stateful assembler for <Workout> blocks. Apple stores per-workout distance and
 * energy in <WorkoutStatistics> children, not on the opening tag — so we feed
 * lines in document order: open on <Workout …>, accumulate Distance and energy
 * from child stats, emit on </Workout>. Used by both the Node and browser streamers.
 */
export class WorkoutCollector {
  private cur: WorkoutRecent | null = null;
  constructor(private sink: (w: WorkoutRecent) => void) {}

  line(line: string): void {
    if (line.indexOf('<Workout ') !== -1) {
      const m = line.match(/<Workout\b[^>]*>/);
      if (m) {
        if (this.cur) this.flush(); // defensive: previous block had no close
        this.cur = parseWorkout(parseAttrs(m[0]));
        if (this.cur && /\/>\s*$/.test(m[0])) this.flush(); // self-closed, no children
      }
      return;
    }
    if (this.cur && line.indexOf('<WorkoutStatistics') !== -1) {
      const m = line.match(/<WorkoutStatistics\b[^>]*>/);
      if (m) {
        const a = parseAttrs(m[0]);
        const sum = Number.parseFloat(a.sum);
        if (a.type) {
          if (Number.isFinite(sum) && a.type.indexOf('Distance') !== -1) this.cur.km += toKm(sum, a.unit);
          else if (Number.isFinite(sum) && a.type.endsWith('ActiveEnergyBurned') && !this.cur.kcal) this.cur.kcal += Math.round(sum);
          else if (a.type.endsWith('HeartRate')) {
            const avg = Number.parseFloat(a.average);
            if (Number.isFinite(avg)) this.cur.hrAvg = Math.round(avg);
          }
        }
      }
      return;
    }
    if (this.cur && line.indexOf('</Workout>') !== -1) this.flush();
  }

  /** Emit any in-progress workout (call at end of stream). */
  flush(): void {
    if (this.cur) {
      this.cur.km = Math.round(this.cur.km * 100) / 100;
      this.sink(this.cur);
      this.cur = null;
    }
  }
}

/** Parse an <ActivitySummary> element into a daily activity-ring record. */
export function parseActivitySummary(attrs: {
  [k: string]: string;
}): ActivityDay | null {
  const date = attrs.dateComponents;
  if (!date) return null;
  const num = (k: string) => {
    const v = Number.parseFloat(attrs[k]);
    return Number.isFinite(v) ? v : 0;
  };
  return {
    date,
    moveKcal: Math.round(num('activeEnergyBurned')),
    moveGoal: Math.round(num('activeEnergyBurnedGoal')),
    exerciseMin: Math.round(num('appleExerciseTime')),
    exerciseGoal: Math.round(num('appleExerciseTimeGoal')),
    standHours: Math.round(num('appleStandHours')),
    standGoal: Math.round(num('appleStandHoursGoal')),
  };
}
