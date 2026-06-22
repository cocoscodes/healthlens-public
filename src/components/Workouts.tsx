'use client';

import type { WorkoutSummary } from '@/lib/types';

export default function Workouts({ workouts }: { workouts?: WorkoutSummary }) {
  if (!workouts || workouts.totalCount === 0) return null;
  const max = Math.max(1, ...workouts.byType.map((t) => t.count));
  return (
    <section className="workouts">
      <h2>Workouts</h2>
      <p className="workouts-sub">
        {workouts.totalCount.toLocaleString()} sessions · {workouts.totalMin.toLocaleString()} min
        {workouts.totalKm > 0 ? ` · ${workouts.totalKm.toLocaleString()} km` : ''} total
      </p>
      {workouts.byType.slice(0, 10).map((t) => (
        <div key={t.type} className="wkrow">
          <span className="wkname">{t.label}</span>
          <span className="wkbar" style={{ width: `${(t.count / max) * 150}px` }} />
          <span className="wknum">
            {t.count}× · {t.totalMin.toLocaleString()} min
            {t.totalKm > 0 ? ` · ${t.totalKm.toLocaleString()} km` : ''}
          </span>
        </div>
      ))}
    </section>
  );
}
