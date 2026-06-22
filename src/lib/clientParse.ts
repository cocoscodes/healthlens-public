'use client';

// Version B: parse an Apple Health export.zip ENTIRELY in the browser.
// fflate streams the zip; export.xml is decoded chunk-by-chunk and folded into
// the shared Aggregator. The file never leaves the device — no upload, no server.

import { Unzip, UnzipInflate } from 'fflate';
import { parseAttrs, normalizeRecord, parseActivitySummary, WorkoutCollector } from './parser';
import { Aggregator } from './aggregator';
import { METRICS, METRIC_META } from './types';
import type { Snapshot } from './types';

const RECORD_RE = /<Record\b[^>]*>/g;

// Process a block of complete lines in document order. Workout blocks span
// multiple lines (distance lives in child <WorkoutStatistics>), so a stateful
// collector consumes lines; Records/ActivitySummary are matched per line.
function processChunk(text: string, agg: Aggregator, wc: WorkoutCollector) {
  const lines = text.split('\n');
  for (const line of lines) {
    wc.line(line);
    if (line.indexOf('<ActivitySummary') !== -1) {
      const am = line.match(/<ActivitySummary\b[^>]*\/?>/);
      if (am) {
        const a = parseActivitySummary(parseAttrs(am[0]));
        if (a) agg.addActivity(a);
      }
    }
    if (line.indexOf('<Record') !== -1) {
      const m = line.match(RECORD_RE);
      if (m) for (const tag of m) {
        const rec = normalizeRecord(parseAttrs(tag));
        if (rec) agg.add(rec);
      }
    }
  }
}

function buildSnapshot(agg: Aggregator, sourceZip: string): Snapshot {
  const rollups = agg.finalize();
  const extras = agg.finalizeExtras();
  const latest: Snapshot['latest'] = [];
  for (const metric of METRICS) {
    const daily = rollups
      .filter((r) => r.metric === metric && r.period === 'daily')
      .sort((a, b) => (a.bucket < b.bucket ? 1 : -1));
    if (!daily.length) continue;
    latest.push({ date: daily[0].bucket, metric, value: daily[0].latest, unit: METRIC_META[metric].unit });
  }
  return {
    generatedAt: new Date().toISOString(),
    sourceZip,
    latest,
    rollups,
    activity: extras.activity,
    workouts: extras.workouts,
  };
}

/** Parse a user-selected export.zip in-browser. Resolves to a Snapshot. */
export async function parseExportZip(file: File): Promise<Snapshot> {
  return new Promise<Snapshot>((resolve, reject) => {
    const agg = new Aggregator();
    const wc = new WorkoutCollector((w) => agg.addWorkout(w));
    const dec = new TextDecoder();
    let leftover = '';
    let found = false;
    let settled = false;

    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (f) => {
      if (!/(^|\/)export\.xml$/.test(f.name)) return;
      found = true;
      f.ondata = (err, chunk, final) => {
        if (settled) return;
        if (err) {
          settled = true;
          reject(err);
          return;
        }
        const text = leftover + dec.decode(chunk, { stream: !final });
        if (final) {
          processChunk(text, agg, wc);
          wc.flush();
          leftover = '';
          settled = true;
          resolve(buildSnapshot(agg, file.name));
          return;
        }
        const nl = text.lastIndexOf('\n');
        if (nl === -1) {
          leftover = text;
          return;
        }
        processChunk(text.slice(0, nl), agg, wc);
        leftover = text.slice(nl + 1);
      };
      f.start();
    };

    (async () => {
      try {
        const reader = file.stream().getReader();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            unzip.push(new Uint8Array(0), true);
            break;
          }
          unzip.push(value, false);
        }
        // give fflate a tick; if no export.xml was found, fail clearly
        setTimeout(() => {
          if (!settled && !found) {
            settled = true;
            reject(new Error('No export.xml found inside the zip. Use the Apple Health "Export All Health Data" file.'));
          }
        }, 50);
      } catch (e) {
        if (!settled) {
          settled = true;
          reject(e);
        }
      }
    })();
  });
}
