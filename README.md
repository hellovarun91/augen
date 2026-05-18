# Augen — AI Ad Studio

End-to-end AI studio for paid media. Onboard any brand (cafe, SaaS, kombucha, bank), let the planner draft a quarter, generate every deliverable across the major ad platforms, review in-app, and approve. Self-contained — no external API keys required.

## What's in the box

- **Brand onboarding from a brief.** Paste a paragraph; Augen synthesizes the full token system (palette, type, scrim, voice, imagery treatment).
- **Quarterly planner.** Drafts three campaigns per quarter (awareness, consideration, conversion) with audience, channels, KPIs, and idea seeds.
- **Idea-driven generation.** Each idea fans out across selected formats × variants. Copy is generated, image prompts authored, and an SVG ad composed deterministically.
- **Multi-platform format catalog.** Meta (feed/story/reels/link), Google Display (300×250, 728×90, 300×600, mobile banner, half-page, skyscraper) + Discovery + YouTube, LinkedIn, Pinterest, TikTok, X, Snap, Reddit.
- **In-app review pipeline.** Pending → approved / needs-revision / rejected. Edit copy inline. Confidence triage.
- **Mock billing.** Every generation costs $0.16, charged against a per-brand mock balance. Top-up free.

## Run it

```bash
npm install
npm run seed    # creates 3 demo brands, plans, and runs one campaign for each
npm run dev
```

Open http://localhost:3000

## Architecture

- **Next.js 15 App Router** with React 19, TypeScript, Tailwind.
- **SQLite via better-sqlite3** — data layer at `data/augen.db`. Schema migrates on first boot.
- **AI engine = deterministic content libraries.** Curated palettes, voice profiles, font pairings, industry-specific ingredient/benefit dictionaries, headline templates, image-prompt scaffolds. Output is shaped like Claude's JSON; provider can be swapped behind the same interface.
- **Composer is SVG + sharp-style.** `lib/composer/render.ts` renders a per-format SVG with photographic-feel background (gradients, atmosphere, grain via feTurbulence, vignette) plus brand chrome (eyebrow, rule, headline, subhead, CTA, locker). Served at `/api/render/[id].svg`.
- **Reproducibility.** Every generation persists its seed, image style, and copy variants. The render endpoint is idempotent.

## Files of interest

- `lib/ai/brand-builder.ts` — brief → tokens
- `lib/ai/planner.ts` — quarterly plan synthesis
- `lib/ai/copy.ts` — copy variants
- `lib/ai/image-prompt.ts` — image prompt author
- `lib/composer/background.ts` — generative photographic backgrounds
- `lib/composer/render.ts` — final ad composition
- `lib/engine/orchestrator.ts` — runs a campaign end-to-end
- `lib/formats.ts` — platform format catalog
- `app/` — Next.js routes

## Swap the mock provider for real APIs

Replace deterministic synth in `lib/ai/*` with calls to your AI provider (Claude, Gemini, etc.). The render contract stays the same — Augen reads SVG. To hand-off to a real image model, change `app/api/render/[id]/route.ts` to fetch from the model and overlay chrome via the existing composer.

## License

Studio prototype — not licensed for redistribution.
