// Shared AI configuration + the COMPACT rollup summary the model reads.
// Token-efficiency cornerstone: the AI never sees raw records — only this.
// Used by both Version A (server route, local key) and Version B (browser, BYOK).

import type { Snapshot, Metric } from './types';
import { METRICS, METRIC_META } from './types';
import { buildMetricView } from './series';

/**
 * SAFETY SYSTEM PROMPT — non-negotiable. Forbids diagnosis, treatment,
 * medication advice, and alarming language; defers to clinicians.
 */
export const SYSTEM_PROMPT =
  'You are an educational assistant that describes patterns in personal health metrics. ' +
  'You are NOT a medical device and NOT a doctor. Never diagnose, never recommend treatment ' +
  'or medication, never use alarming language. Describe trends factually, note when something ' +
  'is outside typical ranges only in general educational terms, and consistently recommend the ' +
  'user discuss any health concerns with a qualified clinician.';

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
export const MAX_TOKENS = 1024;

/** Build a small, model-friendly summary string from rollups (last ~12 weeks). */
export function buildRollupSummary(snap: Snapshot, weeks = 12): string {
  const lines: string[] = [];
  lines.push(`Health metric rollup summary (generated ${snap.generatedAt.slice(0, 10)}).`);
  lines.push('Each line: latest value, 7-day trailing average, and recent weekly trend. Trends only — no raw data.');

  for (const metric of METRICS as readonly Metric[]) {
    const v = buildMetricView(snap, metric);
    if (v.latest == null) continue;
    const meta = METRIC_META[metric];
    const recentWeekly = v.weekly.slice(-weeks);
    const trendStr =
      recentWeekly.length >= 2
        ? `${recentWeekly[0].value}→${recentWeekly[recentWeekly.length - 1].value} over ${recentWeekly.length} wks`
        : 'insufficient history';
    const sparseNote = v.sparse ? ' [sparse: periodic readings]' : '';
    lines.push(
      `- ${meta.label}: latest ${v.latest} ${meta.unit} (${v.latestDate}); ` +
        `7d avg ${v.trailingAvg ?? 'n/a'} ${meta.unit}; weekly ${trendStr}; dir ${v.trendDir}${sparseNote}`,
    );
  }
  return lines.join('\n');
}
