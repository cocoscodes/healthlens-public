'use client';

// No-egress "AI" feature: HealthLens never calls any AI service. It produces a
// de-identified text summary the visitor can copy into THEIR OWN assistant, or
// print/save as PDF. Nothing leaves the browser through this site.

import { useState } from 'react';
import type { Snapshot } from '@/lib/types';
import { SYSTEM_PROMPT, buildRollupSummary } from '@/lib/ai-summary';

export default function AiReport({ snap }: { snap: Snapshot }) {
  const [copied, setCopied] = useState(false);
  const report =
    `${SYSTEM_PROMPT}\n\n` +
    `Here is my personal health rollup summary (de-identified — trends only, no raw records, no name):\n` +
    `${buildRollupSummary(snap)}\n\n` +
    `Please describe these patterns in general, educational terms, and remind me to discuss any concerns with a qualified clinician.`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can select the text manually */
    }
  }

  return (
    <section className="report">
      <h2 className="sec">Ask your own AI (optional)</h2>
      <p className="report-note">
        HealthLens does not send your data anywhere — there is no AI on this site. If you want an AI
        interpretation, copy the summary below into your own assistant (ChatGPT, Claude, etc.) or
        print it for your records. It contains only de-identified trends.
      </p>
      <div className="report-actions">
        <button onClick={copy}>{copied ? 'Copied ✓' : 'Copy summary for your AI'}</button>
        <button onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <textarea className="report-text" readOnly value={report} aria-label="De-identified health summary" />
    </section>
  );
}
