'use client';

// Version B AI insight — BYOK. The visitor's key stays in memory and calls go
// browser → Anthropic directly (no server). Reasons over the compact rollup
// summary, never raw records. Pull-only. Same safety system prompt as Version A.

import { useEffect, useState } from 'react';
import type { Snapshot } from '@/lib/types';
import { METRICS_PUBLIC } from '@/lib/types';
import { SYSTEM_PROMPT, DEFAULT_MODEL } from '@/lib/ai-summary';
import { buildView } from '@/lib/view';
import { useVoice } from '@/lib/useVoice';

interface Turn {
  q: string;
  a: string;
}

function summary(snap: Snapshot): string {
  const lines = ['Health rollup summary (public subset). Recent averages + monthly trend. Trends only — no raw data.'];
  for (const m of METRICS_PUBLIC) {
    const v = buildView(snap, m);
    if (v.head == null) continue;
    const mv = v.monthly;
    const trendStr = mv.length >= 2 ? `${mv[0].v}→${mv[mv.length - 1].v} over ${mv.length} mo` : 'n/a';
    lines.push(`- ${v.label}: ${v.head} ${v.unit} (${v.headKind}); ${trendStr}; ${v.trend}`);
  }
  return lines.join('\n');
}

export default function InsightPanel({ snap }: { snap: Snapshot }) {
  const [apiKey, setApiKey] = useState('');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readAloud, setReadAloud] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const voice = useVoice((text) => {
    setQuestion(text);
    ask(text);
  });

  async function ask(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    if (!apiKey.trim()) {
      setError('Enter your Anthropic API key first (it stays in your browser).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `${summary(snap)}\n\nUser question: ${query}\n\nAnswer using only the summary above; defer to a clinician for any health concern.`,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || 'Request failed');
      } else {
        const answer = (data.content || [])
          .filter((b: { type: string }) => b.type === 'text')
          .map((b: { text: string }) => b.text)
          .join('\n')
          .trim();
        setTurns((t) => [...t, { q: query, a: answer }]);
        setQuestion('');
        if (readAloud) voice.speak(answer);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="insight">
      <div className="insight-head">
        <h2>AI insight</h2>
        <span className="insight-note">
          BYOK · your key stays in your browser, calls go straight to Anthropic · educational only, not medical advice
        </span>
      </div>

      <input
        className="key"
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Anthropic API key (sk-ant-…) — kept in memory only"
        aria-label="Anthropic API key"
      />

      <div className="insight-log">
        {turns.map((t, i) => (
          <div key={i} className="turn">
            <div className="q">{t.q}</div>
            <div className="a">{t.a}</div>
          </div>
        ))}
        {loading && <div className="a loading">Analyzing trends…</div>}
        {error && <div className="err">{error}</div>}
      </div>

      <form
        className="insight-form"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        {mounted && voice.sttSupported && (
          <button
            type="button"
            className={voice.listening ? 'mic on' : 'mic'}
            onClick={() => (voice.listening ? voice.stopListening() : voice.startListening())}
            aria-label={voice.listening ? 'Stop listening' : 'Speak your question'}
          >
            {voice.listening ? 'Listening…' : 'Speak'}
          </button>
        )}
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about a trend…"
          aria-label="Ask about a trend"
        />
        <button type="submit" disabled={loading || !question.trim()}>
          Ask
        </button>
      </form>

      {mounted && voice.ttsSupported && (
        <label className="voice-toggle">
          <input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} />
          Read answers aloud
        </label>
      )}
    </section>
  );
}
