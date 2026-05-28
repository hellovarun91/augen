# Augen — design-first AI ad studio

Augen is a guided studio for making ad creatives at the speed of variation — without losing the designer's instinct.

You walk one ordered loop per project:

```
Overview → Ideate → Copy Sheet → Design → Deliverables
```

- **Ideate** — debate angles with the Strategist; promote the ones you believe in into Copy Sheet rows (with draft copy already written from the hook + promise).
- **Copy Sheet** — the production tool. Rows are *copy variations*, columns are *layers* of the artwork. Cells autosave, the ✨ menu rewrites a line in brand voice, ✦ Review runs the critic per row, the image cell picks from Library / Upload / Stock (Pexels) / Generate (Gemini).
- **Generate** — one click fans every row across the project's formats. Same copy, every size, one brand look. Deterministic SVG composer — no AI cost per design.
- **Design & Review** — approve copy + approve visual. The "ready to ship" badge appears only when both are true and the design isn't stale.
- **Deliverables** — only ready designs land here. Download the bundle, or pull them into Figma with the Augen plugin.

The whole loop has copy↔design **integrity**: editing a row's copy marks its designs amber until you re-render; editing copy on a design flows back to the row and offers to push to its sibling sizes. Nothing AI-spends without your click.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### Environment

`.env.local` (any of these are optional — Augen falls back to honest heuristics where it can):

```bash
ANTHROPIC_API_KEY=sk-...        # Strategist, copywriter, critics, in-cell ✨ / ✦
GEMINI_API_KEY=...              # Image generation in the media cell
PEXELS_API_KEY=...              # Stock photo search in the media cell
AUGEN_DATA_DIR=./data           # SQLite + uploaded refs live here (single volume)
AUTH_REQUIRED=1                 # set to 0 for local dev sign-in bypass (see lib/authz)
```

`npm run seed` scaffolds a demo brand + project if you want a sandbox to play in.

## Surfaces

| Surface | What it does | Path |
|---|---|---|
| **Project Journey** | Overview → Ideate → Copy → Design → Deliverables stepper | `/campaigns/[id]` |
| **Ideate** | Strategist proposes rationale-backed angles → promote to rows | `/campaigns/[id]/agents` |
| **Copy Sheet** | Rows × layers production tool, ✨ rewrites, ✦ critic, media picker, fan-out | `/campaigns/[id]/copy` |
| **Design & review** | Designs grouped by variation, inline Approve / Needs-changes | `/campaigns/[id]/designs` |
| **Deliverables** | Only `ready` designs (dual-gate); ZIP download + Figma pull | `/campaigns/[id]/deliverables` |
| **MCP server** | Drive Augen from Claude Desktop / Code | `/api/mcp` · token management at `/settings/mcp` |
| **Figma plugin** | Pull approved designs into Figma; round-trip tokens | `figma-plugin/` |

## Architecture (short version)

- **Next.js 15** App Router · React 19 · TypeScript · Tailwind v3.
- **SQLite via better-sqlite3** at `${AUGEN_DATA_DIR}/augen.db`; migrations run on first boot.
- **Composer** — deterministic SVG render at `/api/render/[id]/png` (rasterized via `@resvg/resvg-js`). Brand chrome (eyebrow, headline, subhead, CTA, locker) overlays a photographic reference.
- **Agents** — `lib/agents/`: strategist, art-director, copywriter, copy-rewrite (#54), copy-critic (#56), vision-critic. All use the same Claude adapter with brand-voice context and prompt caching; each has an honest heuristic fallback.
- **Image providers** — `lib/images/providers.ts`: Gemini (`gemini-3.1-flash-image-preview` chain) for generation, Pexels for stock, direct upload. The art-director prompt + the appended boilerplate lock the output to *editorial photography* (#52).
- **Integrity model** — generations carry `copy_row_id` + `stale`; `markRowDesignsStale` invalidates approval when copy or media diverges; `designReady` is the predicate the Deliverables gate uses (`lib/repo.ts`).

## Docs

- **[User guide](docs/user-guide.md)** — walk the journey end-to-end.
- **[Journey + Copy Sheet model](docs/journey-and-copy-sheet-model.md)** — the locked architecture spec (the *why* behind #46–#57).
- **[Deploy](DEPLOY.md)** — Railway one-liner.

`BUILD_BRIEF.md` is the original (Airtable-era) brief — kept for context only; superseded by the journey spec.

## License

Studio prototype — not licensed for redistribution.
