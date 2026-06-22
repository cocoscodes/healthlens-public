'use client';

import type { Snapshot } from '@/lib/types';
import { buildView } from '@/lib/view';
import MetricCard from './MetricCard';

export default function Recovery({ snap }: { snap: Snapshot }) {
  const rhr = buildView(snap, 'restingHR');
  const hrv = buildView(snap, 'hrv');
  if (rhr.head == null && hrv.head == null) return null;
  return (
    <section>
      <h2 className="sec">Recovery — autonomic balance</h2>
      <div className="grid">
        {rhr.head != null && <MetricCard view={rhr} />}
        {hrv.head != null && <MetricCard view={hrv} />}
      </div>
      <p className="recnote">
        Rising resting HR together with falling HRV over weeks can indicate cumulative stress or
        under-recovery — discuss any concerns with a clinician. Educational only.
      </p>
    </section>
  );
}
