# Automated ad generator — build brief

This is the working brief for a multi-brand ad generation platform built around a headless TypeScript engine, with Figma as the source of truth for design tokens, Airtable as the review and orchestration surface, and AI handling copy, image generation, and template extraction. Built up from a Tanda Kombucha prototype that proved the pipeline shape.

Treat this as the source of truth for the build. Iterate as needed; flag deviations from the architecture explicitly.

## The core idea, in one paragraph

A designer authors a template in Figma. Claude Code reads the Figma file via MCP, extracts the design tokens and layout grammar, and stores them as a structured brand config. For each ad to generate, Claude produces copy variations and a prompt for Nano Banana 2, which generates a photographic background conditioned on brand reference photos. A deterministic TypeScript composer overlays brand chrome — type, scrim, locker, CTA — on top of the photo. Output lands in Airtable as a queue of ad variants. Marketing reviews and approves in Airtable views. Approved variants get rendered to final files at the required ad-platform dimensions. The loop closes back to Figma when a designer wants to refine the template.

Same engine handles 1 brand or 60K SKUs — what changes is the orchestration layer wrapped around it, not the engine itself.

## What's already built (prototype state)

A working single-brand pipeline exists for a kombucha brand called Tanda. Reference repo at `tanda-kombucha-ads/`. It demonstrates:

- Brief-driven generation across product × audience × angle × format combinations
- Brand-tokenized design system in `src/brand-system.ts`
- Claude API for copy variations and image-prompt authoring
- Nano Banana 2 (`gemini-3.1-flash-image-preview`) for photographic backgrounds with brand reference photos for subject consistency
- Deterministic SVG-based composer with format-aware layouts (4:5, 9:16, 1:1, 1.91:1)
- Static HTML gallery for review and winner marking
- Idempotent re-runs with content caching

What it doesn't have yet, and what this build adds:

- Figma as source of truth for brand tokens (currently hand-authored in TypeScript)
- Template extraction from finished designs
- Airtable as review surface (currently static HTML)
- Multi-brand support (currently hardcoded to Tanda)
- Token system maintenance via AI as designs evolve

## Architecture

### The four primitives

The engine is built around four brand-agnostic primitives. Each is a TypeScript module with a clean async API.

**1. Brand config.** Tokens for color, type, voice, scrim, layout rules, reference images. One source of truth per brand. Versioned with semver. Generated initially from Figma Variables via the MCP bridge.

**2. Template grammar.** Anchored layout rules with a type-scale function, format-aware. Resolves abstract anchor positions and constraints to concrete pixel coordinates per format. Templates are platform-level — brands pick from a catalog and personalize via tokens.

**3. AI content step.** Three calls. Claude for copy variations (structured JSON output). Claude for the image prompt itself (Claude understands cultural and contextual nuance better than templating). Nano Banana 2 for photographic background generation, conditioned on brand reference photos.

**4. Composer.** Deterministic SVG overlay on the photo using sharp. Brand chrome — eyebrow, vertical rule, headline, subhead, CTA-as-type, locker. All five elements appear in every ad, repositioned per format.

### The data flow

```
Figma (templates, tokens)
  ↓  via MCP
Brand config JSON  ←  Claude vision (extract from finished designs)
  ↓
Engine reads config
  ↓
For each (brand × campaign × product × audience × angle × format × variant):
  - Claude generates copy variations
  - Claude generates Nano Banana 2 prompt
  - Nano Banana 2 generates background photo
  - Composer overlays brand chrome
  - Output: PNG + JSON manifest entry
  ↓
Airtable (each row = one ad variant, status field for review)
  ↓
Human approves in Airtable view
  ↓
Webhook triggers final render at platform-specific dimensions
  ↓
Approved files ready for Meta Ads Manager, Google Ads, etc.
```

### Tool selection — committed defaults

These are decisions, not options. Each has reasoning.

**TypeScript / Node.js for the engine.** Same language as Tanda prototype. Strong typing for token schemas. Good Claude SDK and Google GenAI SDK support. Works headlessly, callable from CLI, agent API, or webhook handler.

**Figma + Variables + MCP for design source of truth.** Designers stay in their tool. Variables are queryable via Figma's REST API and via MCP servers. Templates authored in Figma are read by the engine, not redrawn. No Figma plugin runtime — the engine runs outside Figma. This avoids the SheetFusion coupling problem.

**Claude (Sonnet 4.6) for all language and reasoning tasks.** Copy generation, image prompt authoring, template extraction from finished designs, token-system maintenance proposals. Structured output via JSON schema (Zod-validated).

**Nano Banana 2 (Gemini 3.1 Flash Image, `gemini-3.1-flash-image-preview`) for photographic generation.** Native multi-aspect-ratio support, subject consistency via reference images, photorealistic output. Around $0.15 per 4K image. The reference-image conditioning is the key feature — keeps the brand's product visually consistent across all generated ads.

**Airtable for review and orchestration surface.** Relational data model, typed fields, multiple views, Interface Designer for non-coded review surfaces, mature API and webhooks. Replaces the JSON-sidecar manifest from the Tanda prototype. Marketing-team-friendly without building a custom UI.

**sharp for image composition.** SVG overlay composited on raster photo. Crisp at any scale, fast, well-supported.

**Filesystem for assets, Airtable for metadata.** Generated images and SVGs live on disk under `out/{brand-slug}/{campaign}/`. Airtable holds the structured record with links and status. This split keeps Airtable's per-record cell sizes manageable and lets the engine work locally without round-trips.

**Claude Code as the build environment.** All development happens through Claude Code in terminal. The repo is structured to be agent-friendly — clear file boundaries, explicit module APIs, manifest-driven reproducibility.

### Tool selection — explicitly not in the stack

- **No Figma plugin runtime.** Plugins are sandboxed, coupled to one tool, and not agent-callable. The engine reads Figma via API/MCP and runs outside it.
- **No headless browser (Puppeteer, Playwright) for composition.** SVG via sharp covers everything we need. Adding a browser is preemptive complexity.
- **No real database in v1.** Airtable is the working data layer, filesystem holds assets. A real database comes when scale demands it, not before.
- **No Google Sheets as primary surface.** Airtable wins on data structure, views, and Interface Designer. Sheets stays available for long-tail stakeholder reviews if needed, exported from Airtable.
- **No custom React review dashboard yet.** Airtable Interface Designer handles this. A custom React UI comes only if Airtable's surface proves limiting.
- **No animated or video output in v1.** Stills only. Motion comes later via integration with existing Motion Fusion workflows.

## The design token system

This is the bridge between Figma (designer-facing) and the engine (code). It's the most strategically important part of the architecture.

### Token shape

The token schema mirrors the Tanda `brand-system.ts` structure but is loadable from JSON, not authored in TypeScript:

```ts
interface BrandTokens {
  name: string;
  semver: string;
  colors: {
    cream: string;
    creamBright: string;
    tealDeep: string;
    amber: string;
    clay: string;
    [key: string]: string;  // extensible per brand
  };
  fonts: {
    serif: string;   // CSS font-family fallback chain
    sans: string;
  };
  scrim: {
    topColor: string;
    topOpacity: number;
    midColor: string;
    midOpacity: number;
    bottomColor: string;
    bottomOpacity: number;
    coverage: number;  // 0-1, fraction of canvas height
  };
  formats: {
    [ratio: string]: FormatLayout;
  };
  locker: {
    wordmark: string;
    locationLine: string;
  };
  voice: {
    description: string;
    doNot: string[];
  };
  refImages: string[];  // paths to brand reference photos
}
```

### Three flavors of AI involvement with tokens

Build in this order:

**Flavor 1 — generate tokens from a brief.** Claude takes a one-paragraph brand description and proposes a complete token set as JSON. Useful for new brand onboarding. Build this first because it's the simplest and unlocks fast multi-brand experiments.

**Flavor 2 — extract tokens from existing artwork.** Claude vision examines a finished ad (PNG/PSD/AI), extracts dominant colors with semantic naming, identifies type pairings, infers spacing patterns and scrim treatment. Output is the same JSON shape. Build this second — it closes the loop on "generate templates from finished designs" (Atom primitive #1).

**Flavor 3 — maintain tokens as designs evolve.** Watch Figma Variables for changes (via MCP polling or webhooks), propose token-system updates ("this new color is being used in 12 places, promote to a named token?"), write approved updates back to the brand config. Build this last — it's the most valuable but requires Flavors 1 and 2 to be solid first.

### Figma ↔ engine flow

Figma Variables collection → exported to JSON via Figma REST API → mapped to `BrandTokens` schema → consumed by engine. Designer changes flow Figma → JSON. AI-proposed changes flow JSON → Figma (write back). Round-trippable.

When Figma's Variable types don't map cleanly to a token (e.g., scrim gradient parameters), use a naming convention: `scrim/top/color`, `scrim/top/opacity`, etc. The Figma-to-JSON converter flattens these into nested objects.

## The Airtable schema

Airtable is the structured data layer that replaces the prototype's filesystem-as-database approach. Here's the schema.

### Tables

**Brands** — one row per brand. Fields:
- Name (single line)
- Slug (single line, unique)
- Tokens JSON (long text, version-controlled)
- Reference Images (attachments)
- Voice description (long text)
- Default template (link to Templates)
- Status (single select: active, archived)

**Templates** — platform-level design grammars. Fields:
- Name (single line)
- Description (long text)
- Source Figma file URL (URL)
- Schema JSON (long text — layout grammar serialized)
- Created (date)
- Used by brands (rollup from Brands)

**Campaigns** — one row per advertising effort. Fields:
- Name (single line)
- Brand (link to Brands)
- Brief JSON (long text)
- Status (single select: draft, generating, ready_for_review, approved, exported)
- Created (date)
- Generated count (count from Generations)

**Generations** — one row per ad variant. This is the working surface for review. Fields:
- ID (formula: brand + campaign + product + audience + angle + format + variant)
- Brand (link to Brands)
- Campaign (link to Campaigns)
- Product SKU (single line)
- Audience (single line)
- Angle (single line)
- Format (single select: 4:5, 9:16, 1:1, 1.91:1, custom)
- Variant number (number)
- Final image (attachment)
- Raw image (attachment — Nano Banana output without composer overlay)
- Headline (single line)
- Subhead (single line)
- CTA (single line)
- All copy variations (long text — JSON array)
- Image prompt used (long text)
- Status (single select: pending_review, approved, rejected, needs_revision)
- Confidence score (number, 0-1, from QC agent)
- Reviewer notes (long text)
- Approved by (collaborator field)
- Approved at (date)

**Format Specs** — output dimensions for each platform. Fields:
- Format ID (single line, primary)
- Aspect ratio (single line)
- Width px (number)
- Height px (number)
- Platform (single select: Meta, Google Ads, Pinterest, LinkedIn, custom)
- Max file size KB (number)

### Views

**By campaign, pending review.** Filter Generations where Status = pending_review, grouped by Campaign, sorted by Confidence score ascending (low-confidence first).

**Approved, ready for export.** Filter Generations where Status = approved AND Final image exists, grouped by Campaign and Format.

**Brand audit.** Filter Generations grouped by Brand, count by Status — gives you a one-glance view of throughput per brand.

**Confidence triage.** All Generations with Confidence score < 0.7, sorted ascending. The exception queue.

### Interface (built with Airtable Interface Designer)

A single Interface page per Campaign with three sections:

- Stats row — counts by status, throughput chart
- Review queue — grid of pending Generations with image preview, headline, CTA, and approve/reject buttons
- Approved gallery — grid of approved Generations grouped by Format

No custom code needed. Build this once and replicate per Brand or Campaign as needed.

## Repository structure

Monorepo. Workspace packages with internal references.

```
ad-platform/
├── packages/
│   ├── engine/                # the headless TypeScript engine
│   │   ├── src/
│   │   │   ├── orchestrator.ts        # campaign runner, fans out jobs
│   │   │   ├── jobs.ts                 # job creation and caching
│   │   │   ├── copy.ts                 # Claude API calls for copy
│   │   │   ├── image-prompt.ts         # Claude API call to author image prompts
│   │   │   ├── image.ts                # Nano Banana 2 calls
│   │   │   ├── composer.ts             # SVG overlay + sharp composition
│   │   │   ├── resolve-layout.ts       # template grammar → concrete coordinates
│   │   │   ├── tokens.ts               # BrandTokens schema, loader, validator
│   │   │   ├── manifest.ts             # generation record keeping
│   │   │   ├── airtable.ts             # Airtable API client
│   │   │   ├── figma.ts                # Figma API + MCP client
│   │   │   └── types.ts                # shared types and Zod schemas
│   │   └── package.json
│   ├── templates/             # platform-level design grammars
│   │   ├── editorial-serif/
│   │   ├── bold-sans/
│   │   ├── card-stack/
│   │   └── ...
│   ├── token-tools/           # AI-driven token system tools
│   │   ├── src/
│   │   │   ├── generate-from-brief.ts  # Flavor 1
│   │   │   ├── extract-from-design.ts  # Flavor 2
│   │   │   └── sync-from-figma.ts      # Flavor 3
│   │   └── package.json
│   ├── formats/               # format catalog (platform constants)
│   └── cli/
│       └── src/index.ts
├── brands/                    # brand configs and assets (gitignored content)
│   ├── tanda-kombucha/
│   │   ├── tokens.json
│   │   ├── refs/
│   │   ├── fonts/
│   │   └── campaigns/
│   └── ...
├── out/                       # generated outputs (gitignored)
│   └── {brand-slug}/{campaign-slug}/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── BRAND_ONBOARDING.md
│   └── TOKEN_SCHEMA.md
├── CLAUDE.md                  # working notes for Claude Code agent
└── package.json               # workspace root
```

## API surface

### CLI

```
adgen run <brand-slug>/<campaign-slug>          # generate all jobs
adgen run <campaign> --filter audience=gut_health
adgen run <campaign> --dry-run                   # validate and estimate cost
adgen extract <design-image-path> <brand-slug>   # Flavor 2 token extraction
adgen generate-brand --brief "..." --slug acme   # Flavor 1 brand generation
adgen sync <brand-slug>                          # Flavor 3 Figma → tokens
adgen sync-to-airtable <brand>/<campaign>        # push manifest to Airtable
adgen render <generation-id>                     # final render at platform sizes
adgen reproduce <generation-id>                  # rerun from manifest
adgen new-brand <slug>                           # scaffold brands/<slug>/
adgen new-campaign <brand> <name>                # scaffold a campaign brief
```

### Library

The CLI is a thin wrapper around exported library functions. Key exports from `@adplatform/engine`:

- `runCampaign(brief: Brief): Promise<GenerationManifest>`
- `generateOne(job: AdJob): Promise<Generation>`
- `loadBrand(slug: string): Promise<Brand>`
- `loadTemplate(id: string): Promise<Template>`
- `resolveLayout(template: Template, format: Format): ResolvedLayout`
- `extractTokensFromDesign(imagePath: string): Promise<BrandTokens>`
- `generateTokensFromBrief(brief: string): Promise<BrandTokens>`
- `syncFromFigma(brandSlug: string): Promise<TokenDiff>`
- `pushToAirtable(manifest: GenerationManifest): Promise<void>`

## Build order

For Claude Code working through this, here's the priority sequence. Each step produces something runnable before moving to the next.

**Step 1 — port the Tanda prototype into the monorepo.** Copy `tanda-kombucha-ads/` content into `packages/engine/` and `brands/tanda-kombucha/`. Verify the existing Tanda campaign still runs from the new structure. No new functionality — just relocation.

**Step 2 — extract the token system into JSON.** Convert `brand-system.ts` into `brands/tanda-kombucha/tokens.json`. Write a loader that hydrates the JSON into the same shape the composer expects. Verify Tanda still generates identically.

**Step 3 — Airtable integration.** Wire the manifest to Airtable. Each generation writes a row. Build the Brands, Templates, Campaigns, Generations, Format Specs tables. Create the views. Test with the Tanda campaign.

**Step 4 — Airtable Interface Designer.** Build the review interface. Test the approve/reject flow manually.

**Step 5 — Flavor 1: generate brand from brief.** A CLI command that takes a one-paragraph brief and produces `tokens.json` for a new brand. Test by generating a second brand (e.g., a fictional coffee brand) and running a campaign through the engine.

**Step 6 — Flavor 2: extract tokens from a design.** Claude vision endpoint that takes a finished ad image and emits `tokens.json`. Test by feeding it a known design (the Tanda hero) and verifying the extracted tokens match the original within tolerance.

**Step 7 — Figma integration via MCP.** Read Figma Variables from a designated brand file, convert to `tokens.json`. Then write Flavor 3 — propose updates back to Figma when the engine's tokens drift.

**Step 8 — webhook-driven final render.** Airtable webhook fires when a Generation moves to approved. Webhook handler renders the final at platform-specific dimensions, writes back to Airtable as the Final image attachment.

Stop after Step 8. The platform is functional. Anything beyond is feature work driven by real usage, not speculation.

## Open questions

These need a decision before or during the build. Surface them and ask before assuming.

1. **Project name.** "ad-platform" is the placeholder. Naming continues the "Fusion" family? Something else? Affects package names throughout.
2. **Hosted runtime or local-only?** Local-only is simpler for v1. Cloud worker (e.g., GitHub Actions or Cloud Run) becomes interesting when campaigns get large.
3. **Multi-tenant Airtable or per-brand bases?** Single base with Brand-linked records works up to ~10 brands. Per-brand bases scale further but make cross-brand reporting harder. Decide before building Airtable integration.
4. **Cost guardrails.** Hard cap per campaign? Confirmation prompt above N jobs? Both? Around $0.16 per ad means a careless run can spend $50+ before noticing.
5. **Reference image management.** Stored per brand in `brands/{slug}/refs/`, or uploaded to Airtable Brands table? Filesystem is simpler; Airtable is more accessible to non-technical brand leads.
6. **Existing Fusion tool integration.** Should the engine emit data that Motion Fusion can consume (for video versions of approved ads)? Should it read from SheetFusion-shaped sheets when present?

## Constraints and reminders

- The engine is brand-agnostic. No Tanda-specific logic anywhere in `packages/engine/`. Brand specifics live in `brands/`.
- Templates are platform-level, not per-brand. A new brand picks from the template catalog and personalizes via tokens — it does not author a new template.
- Models are pinned per generation. Manifest records exact model IDs (`claude-sonnet-4-6`, `gemini-3.1-flash-image-preview`) and prompt template version hashes for reproducibility.
- Concurrency is bounded. Default 3 simultaneous API calls. Configurable via env var.
- Caching is per step. Copy cached at `(product × audience × angle)`. Image prompts and images per-job.
- No silent fallbacks. Missing template → fail at load. Missing font → log warning, fall back to system fonts. Missing API key → fail at startup with clear message.
- Reproducibility is a feature, not a nice-to-have. `adgen reproduce <id>` must run.

## Where to find context

- `tanda-kombucha-ads/` — the working prototype. Read first.
- `PLATFORM_OVERVIEW.md` — the earlier architecture document. This brief supersedes it; use that doc for context, not for implementation decisions.
- Conversation history with Varun — the architectural reasoning behind specific choices (why Airtable not Sheets, why no Figma plugin, why headless engine). Worth scanning before deviating from the committed defaults.

## Starting point for Claude Code

First session prompt:

> Read this brief, then read `tanda-kombucha-ads/` to understand the working prototype. Then read `PLATFORM_OVERVIEW.md` for additional context. Confirm the open questions above with me. Once those are answered, scaffold the monorepo per the repository structure section and complete Step 1 of the build order — port the Tanda prototype into the new structure and verify the existing campaign still runs. Show me the file list before writing anything substantial.

The goal of the first session is Step 1 complete and the second brand scaffold in flight. Everything beyond is iterative.
