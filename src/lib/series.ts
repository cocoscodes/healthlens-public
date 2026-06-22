// Pure helpers to shape rollups into chart series + headline stats for the UI.
import type { Metric, Rollup, Snapshot, TrendDir } from './types';
import { METRIC_META } from './types';

export interface Point {
  date: string;
  value: number;
}

export interface MetricView {
  metric: Metric;
  label: string;
  unit: string;
  latest: number | null;
  latestDate: string | null;
  /** Trailing average over the last `trailingDays` of daily buckets. */
  trailingAvg: number | null;
  trailingDays: number;
  trendDir: TrendDir;
  daily: Point[];
  weekly: Point[];
  sampleCount: number;
  /** True when the metric has very few data points (e.g. periodic weigh-ins). */
  sparse: boolean;
}

function sortByBucket(rows: Rollup[]): Rollup[] {
  return [...rows].sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

export function buildMetricView(snap: Snapshot, metric: Metric, trailingDays = 7): MetricView {
  const daily = sortByBucket(snap.rollups.filter((r) => r.metric === metric && r.period === 'daily'));
  const weekly = sortByBucket(snap.rollups.filter((r) => r.metric === metric && r.period === 'weekly'));
  const meta = METRIC_META[metric];

  const last = daily[daily.length - 1];
  const tail = daily.slice(-trailingDays);
  const trailingAvg =
    tail.length > 0 ? tail.reduce((s, r) => s + r.latest, 0) / tail.length : null;

  return {
    metric,
    label: meta.label,
    unit: meta.unit,
    latest: last ? last.latest : null,
    latestDate: last ? last.bucket : null,
    trailingAvg: trailingAvg == null ? null : Math.round(trailingAvg * 100) / 100,
    trailingDays,
    trendDir: last ? last.trendDir : 'flat',
    daily: daily.map((r) => ({ date: r.bucket, value: r.latest })),
    weekly: weekly.map((r) => ({ date: r.bucket, value: r.latest })),
    sampleCount: daily.length,
    sparse: daily.length > 0 && daily.length < 30,
  };
}
