'use client';

import { FOCI, type Focus } from '@/lib/focus';

export default function FocusBar({ focus, onChange }: { focus: Focus; onChange: (f: Focus) => void }) {
  return (
    <div className="focusbar">
      <div className="focusbar-row">
        <span className="focusbar-label">Focus</span>
        {FOCI.map((f) => (
          <button
            key={f.id}
            className={f.id === focus.id ? 'focus-chip on' : 'focus-chip'}
            onClick={() => onChange(f)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="focusbar-blurb">{focus.blurb}</p>
    </div>
  );
}
