'use client';

import { useRef } from 'react';
import { FOCI, type Focus } from '@/lib/focus';

export default function FocusBar({ focus, onChange }: { focus: Focus; onChange: (f: Focus) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' ? (i + 1) % FOCI.length : (i - 1 + FOCI.length) % FOCI.length;
    onChange(FOCI[next]);
    refs.current[next]?.focus();
  }

  return (
    <div className="focusbar">
      <div className="focusbar-row" role="tablist" aria-label="Dashboard focus">
        <span className="focusbar-label" id="focus-label">Focus</span>
        {FOCI.map((f, i) => (
          <button
            key={f.id}
            ref={(el) => { refs.current[i] = el; }}
            role="tab"
            aria-selected={f.id === focus.id}
            aria-controls="main"
            tabIndex={f.id === focus.id ? 0 : -1}
            className={f.id === focus.id ? 'focus-chip on' : 'focus-chip'}
            onClick={() => onChange(f)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="focusbar-blurb">{focus.blurb}</p>
    </div>
  );
}
