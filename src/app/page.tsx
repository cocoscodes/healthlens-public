'use client';

import { useMemo, useState } from 'react';
import { sampleSnapshot } from '@/lib/sample';
import { buildView } from '@/lib/view';
import { FOCI, type Focus } from '@/lib/focus';
import type { Metric, Snapshot } from '@/lib/types';
import UploadZone from '@/components/UploadZone';
import FocusBar from '@/components/FocusBar';
import MetricCard from '@/components/MetricCard';
import ActivityTrend from '@/components/ActivityTrend';
import Recovery from '@/components/Recovery';
import Efficiency from '@/components/Efficiency';
import Workouts from '@/components/Workouts';
import ClinicalSummary from '@/components/ClinicalSummary';
import AiReport from '@/components/AiReport';

// Same grouping as the private Version A artifact.
const GROUPS: [string, Metric[]][] = [
  ['Body composition', ['weight', 'bodyFatPct', 'bmi', 'leanMass']],
  ['Heart & lungs', ['restingHR', 'heartRate', 'walkingHR', 'hrRecovery', 'hrv', 'vo2max', 'spo2', 'respRate']],
  ['Activity totals', ['steps', 'activeEnergy']],
  ['Sleep', ['sleepHours', 'napHours']],
];

export default function Home() {
  const sample = useMemo(() => sampleSnapshot(), []);
  const [snap, setSnap] = useState<Snapshot>(sample);
  const [source, setSource] = useState<'sample' | string>('sample');
  const [focus, setFocus] = useState<Focus>(FOCI[0]);
  const isSample = source === 'sample';
  const priorityViews = focus.priority.map((m) => buildView(snap, m)).filter((v) => v.head != null);

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

      <FocusBar focus={focus} onChange={setFocus} />

      {priorityViews.length > 0 && (
        <section>
          <h2 className="sec">Priority — {focus.label}</h2>
          <div className="grid">
            {priorityViews.map((v) => (
              <MetricCard key={`p-${v.metric}`} view={v} />
            ))}
          </div>
        </section>
      )}

      <ActivityTrend snap={snap} />

      {GROUPS.map(([title, metrics]) => {
        const views = metrics.map((m) => buildView(snap, m)).filter((v) => v.head != null);
        if (!views.length) return null;
        return (
          <section key={title}>
            <h2 className="sec">{title}</h2>
            <div className="grid">
              {views.map((v) => (
                <MetricCard key={v.metric} view={v} />
              ))}
            </div>
          </section>
        );
      })}

      <Recovery snap={snap} />

      <Efficiency snap={snap} />

      <Workouts workouts={snap.workouts} />

      <ClinicalSummary snap={snap} focus={focus} />

      <AiReport snap={snap} />

      <footer className="foot">
        Open-source demo · {isSample ? 'synthetic data' : 'in-browser parse of your file'} · no health data is sent
        to any server, and there is no AI on this site. Not a medical device. ·{' '}
        <a href="/privacy">Privacy &amp; Terms</a>
      </footer>
    </main>
  );
}
