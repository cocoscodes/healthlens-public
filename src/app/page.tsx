'use client';

import { useMemo, useState } from 'react';
import { sampleSnapshot } from '@/lib/sample';
import { buildView } from '@/lib/view';
import { METRICS_PUBLIC } from '@/lib/types';
import type { Snapshot } from '@/lib/types';
import UploadZone from '@/components/UploadZone';
import MetricCard from '@/components/MetricCard';
import Recovery from '@/components/Recovery';
import Efficiency from '@/components/Efficiency';
import Workouts from '@/components/Workouts';
import InsightPanel from '@/components/InsightPanel';

export default function Home() {
  const sample = useMemo(() => sampleSnapshot(), []);
  const [snap, setSnap] = useState<Snapshot>(sample);
  const [source, setSource] = useState<'sample' | string>('sample');

  const views = METRICS_PUBLIC.map((m) => buildView(snap, m));
  const isSample = source === 'sample';

  return (
    <main className="shell">
      <header className="header">
        <h1>HealthLens</h1>
        <p className="tagline">
          This is how my personal health dashboard looks — and how yours might look one day.
        </p>
        <p className="sub">
          A privacy-first view of Apple Health trends. {isSample ? 'Showing synthetic sample data.' : `Showing your upload: ${source}.`}
        </p>
      </header>

      <UploadZone
        onSnapshot={(s, name) => {
          setSnap(s);
          setSource(name);
        }}
      />

      {!isSample && (
        <button
          className="reset"
          onClick={() => {
            setSnap(sample);
            setSource('sample');
          }}
        >
          ← Back to sample data
        </button>
      )}

      <div className="grid">
        {views.map((v) => (
          <MetricCard key={v.metric} view={v} />
        ))}
      </div>

      <Recovery snap={snap} />

      <Efficiency snap={snap} />

      <Workouts workouts={snap.workouts} />

      <InsightPanel snap={snap} />

      <footer className="foot">
        Open-source demo · {isSample ? 'synthetic data' : 'in-browser parse of your file'} · no health data is sent
        to any server. Not a medical device.
      </footer>
    </main>
  );
}
