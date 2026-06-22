# HealthLens (public demo) — Version B

The public, deployable companion to the private HealthLens dashboard.

> "This is how my personal health dashboard looks — and how yours might look one day."

> **Not a medical device.** Informational and educational use only — not diagnostic,
> not medical advice. Always consult a qualified healthcare professional.

## What it does

- Loads with **synthetic sample data** so it's instantly explorable.
- Visitors can upload their own Apple Health `export.zip` — **parsed entirely in
  the browser** (via `fflate`), streamed and aggregated client-side. The file
  **never leaves the device** and nothing is stored on any server.
- **BYOK**: the visitor enters their own Anthropic API key; AI calls go
  **browser → Anthropic directly** (key kept in memory only).
- Simplified metric subset: **weight, body fat %, steps, resting HR, sleep**.
- Charts default to monthly trends (weekly/daily toggles) with labeled axes;
  headline = trailing-90-day average.

## Privacy model

- No server-side storage of any uploaded health data, ever.
- No backend route touches your file or your key — everything runs in the browser.
- Only synthetic data is committed to this repo.

## Shared with Version A

Reuses the same core unchanged: `parser.ts`, `aggregator.ts`, `ai-summary.ts`
(safety system prompt), `series.ts`, `view.ts`, `types.ts`, `metrics.ts`. The
only Version-B-specific pieces are `clientParse.ts` (in-browser zip/XML),
`sample.ts` (synthetic seed), and the upload/BYOK UI.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

## Deploy to Vercel

```bash
npm install -g vercel     # if you don't have it
vercel login
vercel                    # preview deploy (follow prompts; accept defaults)
vercel --prod             # production deploy -> your https URL
```

No environment variables are required — the demo ships synthetic data and the AI
panel uses the visitor's own key at runtime. Once deployed over `https`, the
voice mic works with no extra setup.
