// Online rollup aggregator. Records are fed one-by-one during the stream and
// folded into bounded accumulators, so we never hold millions of raw records in
// memory. Produces daily + weekly Rollup rows per metric.
//
// Aggregation semantics:
//  - point metrics  : min/max/avg/latest over a bucket's readings.
//  - additive metrics (steps, activeEnergy) and sleep: sum PER SOURCE within a
//    bucket, then take the dominant (max) source total — avoids double-counting
//    iPhone+Watch overlap. `latest` carries the bucket TOTAL.
//  - weekly additive/sleep are derived from daily totals (so weekly min/max/avg
//    describe the per-day spread, and latest = the week's sum).

import type {
  Metric,
  Rollup,
  Period,
  TrendDir,
  ActivityDay,
  WorkoutRecent,
  WorkoutSummary,
} from './types';
import { METRICS } from './types';
import type { ParsedRecord } from './parser';

interface PointAcc {
  sum: number;
  count: number;
  min: number;
  max: number;
  latestTs: number;
  latestVal: number;
}
interface SrcAcc {
  sum: number;
  count: number;
}

/** ISO-8601 week key, e.g. "2026-W12". */
export function isoWeek(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7; // Mon=1..Sun=7
  dt.setUTCDate(dt.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function trend(cur: number, prev: number): TrendDir {
  const diff = cur - prev;
  const threshold = Math.abs(prev) * 0.01;
  if (diff > threshold) return 'up';
  if (diff < -threshold) return 'down';
  return 'flat';
}

export class Aggregator {
  // point: key = `${metric}|${period}|${bucket}`
  private point = new Map<string, PointAcc>();
  // additive/sleep daily by source: key = `${metric}|${date}|${source}`
  private addSrc = new Map<string, SrcAcc>();
  // exact cross-source dedupe for point metrics: `${metric}|${ts}|${value}`
  private seen = new Set<string>();
  // workouts + activity rings (non-Record elements)
  private wByType = new Map<string, { label: string; count: number; totalMin: number; totalKcal: number; totalKm: number }>();
  private wRecent: WorkoutRecent[] = [];
  private wTotals = { count: 0, min: 0, kcal: 0, km: 0 };
  // per (type, month) efficiency accumulators: key = `${type}|${YYYY-MM}`
  private wEff = new Map<string, { type: string; label: string; sessions: number; min: number; km: number; kcal: number; hrSum: number; hrMin: number }>();
  private activity = new Map<string, ActivityDay>();

  addWorkout(w: WorkoutRecent): void {
    const a = this.wByType.get(w.type) ?? { label: w.label, count: 0, totalMin: 0, totalKcal: 0, totalKm: 0 };
    a.count += 1;
    a.totalMin += w.min;
    a.totalKcal += w.kcal;
    a.totalKm += w.km;
    this.wByType.set(w.type, a);
    this.wRecent.push(w);
    this.wTotals.count += 1;
    this.wTotals.min += w.min;
    this.wTotals.kcal += w.kcal;
    this.wTotals.km += w.km;
    // monthly efficiency accumulation
    const ek = `${w.type}|${w.date.slice(0, 7)}`;
    const e = this.wEff.get(ek) ?? { type: w.type, label: w.label, sessions: 0, min: 0, km: 0, kcal: 0, hrSum: 0, hrMin: 0 };
    e.sessions += 1;
    e.min += w.min;
    e.km += w.km;
    e.kcal += w.kcal;
    if (w.hrAvg > 0) {
      e.hrSum += w.hrAvg * w.min;
      e.hrMin += w.min;
    }
    this.wEff.set(ek, e);
  }

  addActivity(a: ActivityDay): void {
    // one summary per day; keep the richest (max move kcal) if duplicated
    const cur = this.activity.get(a.date);
    if (!cur || a.moveKcal > cur.moveKcal) this.activity.set(a.date, a);
  }

  finalizeExtras(): { activity: ActivityDay[]; workouts: WorkoutSummary } {
    const activity = [...this.activity.values()].sort((x, y) => (x.date < y.date ? -1 : 1));
    const byType = [...this.wByType.entries()]
      .map(([type, v]) => ({
        type,
        label: v.label,
        count: v.count,
        totalMin: Math.round(v.totalMin),
        totalKcal: Math.round(v.totalKcal),
        totalKm: Math.round(v.totalKm * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);
    const recent = [...this.wRecent].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 15);
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const efficiency = [...this.wEff.entries()]
      .map(([key, e]) => {
        const month = key.split('|')[1];
        const paceKmh = e.min > 0 && e.km > 0 ? (e.km / (e.min / 60)) : 0;
        const hrAvg = e.hrMin > 0 ? e.hrSum / e.hrMin : 0;
        return {
          month,
          type: e.type,
          label: e.label,
          sessions: e.sessions,
          km: r1(e.km),
          paceKmh: r1(paceKmh),
          kcalPerMin: e.min > 0 ? Math.round((e.kcal / e.min) * 10) / 10 : 0,
          hrAvg: Math.round(hrAvg),
          aeroEff: paceKmh > 0 && hrAvg > 0 ? Math.round((paceKmh / hrAvg) * 1000 * 10) / 10 : 0,
        };
      })
      .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : a.type < b.type ? -1 : 1));
    return {
      activity,
      workouts: {
        totalCount: this.wTotals.count,
        totalMin: Math.round(this.wTotals.min),
        totalKcal: Math.round(this.wTotals.kcal),
        totalKm: Math.round(this.wTotals.km * 10) / 10,
        byType,
        recent,
        efficiency,
      },
    };
  }

  add(rec: ParsedRecord): void {
    if (rec.agg === 'point') {
      const dk = `${rec.metric}|${rec.ts}|${rec.value}`;
      if (this.seen.has(dk)) return; // identical reading from another source
      this.seen.add(dk);
      this.addPoint(rec.metric, 'daily', rec.date, rec);
      this.addPoint(rec.metric, 'weekly', isoWeek(rec.date), rec);
    } else {
      // additive or sleep: accumulate per (metric, date, source)
      const k = `${rec.metric}|${rec.date}|${rec.source}`;
      const a = this.addSrc.get(k) ?? { sum: 0, count: 0 };
      a.sum += rec.value;
      a.count += 1;
      this.addSrc.set(k, a);
    }
  }

  private addPoint(metric: Metric, period: Period, bucket: string, rec: ParsedRecord) {
    const k = `${metric}|${period}|${bucket}`;
    const a = this.point.get(k);
    if (!a) {
      this.point.set(k, {
        sum: rec.value,
        count: 1,
        min: rec.value,
        max: rec.value,
        latestTs: rec.ts,
        latestVal: rec.value,
      });
      return;
    }
    a.sum += rec.value;
    a.count += 1;
    if (rec.value < a.min) a.min = rec.value;
    if (rec.value > a.max) a.max = rec.value;
    if (rec.ts >= a.latestTs) {
      a.latestTs = rec.ts;
      a.latestVal = rec.value;
    }
  }

  /** Collapse additive/sleep per-source accumulators to one total per (metric,date). */
  private dailyTotals(): Map<Metric, Map<string, { total: number; count: number }>> {
    const out = new Map<Metric, Map<string, { total: number; count: number }>>();
    for (const [key, a] of this.addSrc) {
      const [metric, date] = key.split('|') as [Metric, string];
      let byDate = out.get(metric);
      if (!byDate) {
        byDate = new Map();
        out.set(metric, byDate);
      }
      const cur = byDate.get(date);
      // dominant source wins (max total) — not a sum across sources
      if (!cur || a.sum > cur.total) byDate.set(date, { total: a.sum, count: a.count });
    }
    return out;
  }

  finalize(): Rollup[] {
    const rows: Rollup[] = [];

    // --- point metrics (daily + weekly accumulated directly) ---
    for (const [k, a] of this.point) {
      const [metric, period, bucket] = k.split('|') as [Metric, Period, string];
      rows.push({
        metric,
        period,
        bucket,
        min: round(a.min),
        max: round(a.max),
        avg: round(a.sum / a.count),
        latest: round(a.latestVal),
        trendDir: 'flat',
        sampleCount: a.count,
      });
    }

    // --- additive / sleep metrics ---
    const totals = this.dailyTotals();
    for (const [metric, byDate] of totals) {
      // daily rows: bucket total
      for (const [date, { total, count }] of byDate) {
        rows.push({
          metric,
          period: 'daily',
          bucket: date,
          min: round(total),
          max: round(total),
          avg: round(total),
          latest: round(total),
          trendDir: 'flat',
          sampleCount: count,
        });
      }
      // weekly rows: derived from daily totals (spread across days + weekly sum)
      const byWeek = new Map<string, number[]>();
      for (const [date, { total }] of byDate) {
        const w = isoWeek(date);
        (byWeek.get(w) ?? byWeek.set(w, []).get(w)!).push(total);
      }
      for (const [week, dayTotals] of byWeek) {
        const sum = dayTotals.reduce((s, v) => s + v, 0);
        rows.push({
          metric,
          period: 'weekly',
          bucket: week,
          min: round(Math.min(...dayTotals)),
          max: round(Math.max(...dayTotals)),
          avg: round(sum / dayTotals.length),
          latest: round(sum), // week total
          trendDir: 'flat',
          sampleCount: dayTotals.length,
        });
      }
    }

    return this.applyTrend(rows);
  }

  /** Set trendDir per (metric, period) by comparing each bucket to the previous. */
  private applyTrend(rows: Rollup[]): Rollup[] {
    const groups = new Map<string, Rollup[]>();
    for (const r of rows) {
      const g = `${r.metric}|${r.period}`;
      (groups.get(g) ?? groups.set(g, []).get(g)!).push(r);
    }
    for (const g of groups.values()) {
      g.sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
      for (let i = 1; i < g.length; i++) {
        g[i].trendDir = trend(g[i].latest, g[i - 1].latest);
      }
    }
    return rows;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Expected rollup count helper for the ingest success check. */
export function expectedMetrics(): Metric[] {
  return [...METRICS];
}
