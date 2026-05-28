# Augen user guide

A walk through one project, end to end. If you've never used Augen, do this in order on a real project — the muscle memory builds itself.

Every project page has the same stepper at the top:

```
Overview → Ideate → Copy → Design → Deliverables
```

A ✓ + count appears on each step once it has work. You can move freely; you don't have to walk in order. But the natural shape is Ideate first.

---

## 0 · Sign in

http://localhost:3000/signin (or your deploy URL).

Pick or create a brand on `/brands`. A brand carries voice, palette, type, imagery direction, and the default copy structure every project starts from.

---

## 1 · Overview

`/campaigns/[id]`

The project's home. The brief lives here ("Formats enabled" is the size set every row will fan to). The "Idea seeds" and Deliverables sections summarise what the project already has.

You usually leave Overview within a minute — you came here to *make*.

---

## 2 · Ideate

`/campaigns/[id]/agents` · the **Ideate** step.

This is where you decide *what to make*, with the Strategist.

1. **Direction box** — write a one-paragraph steer (angle, audience, mood). Example:
   > *Speak to career-switchers who feel behind. Confident, not preachy. Lean on the certificate as proof.*
2. **Propose angles** — Strategist returns a few rationale-backed cards: **Why** (the insight), **Angle**, **Promise**, audience, draft **hooks**.
3. On any card you believe in → **Add to Copy Sheet →**. It flips to *"Added ✓ · Open Copy Sheet"*. The hook becomes the row's headline, the promise becomes the subhead.
4. Re-run with new direction to add more — Ideate stays open.

Below the angle cards there's a collapsible **"Behind the scenes"** with the agent run history and an older direct-generate path. Useful for trust, not for the daily loop.

---

## 3 · Copy Sheet

`/campaigns/[id]/copy` · the production tool.

**Model:** each **row** is a *copy variation* (give it a name — that name also names the designs it makes). Each **column** is a *layer* of the artwork (eyebrow / headline / subhead / CTA, plus brand-custom ones).

### Edit cells
- Click any cell, type. Autosaves on blur.
- **✨** appears on hover (top-right of each cell) → **Punchier / Shorter / Match brand voice**. Run one; the suggestion drops in an indigo box under the cell. **Accept** writes it and autosaves. **Reject** dismisses. (The row's other cells go in as context, so the rewrite knows what the rest of the row says.)

### Review a row
- Click **✦ Review copy** in the row's identity cell. A score-toned box appears:
  - **Emerald** ≥ 80, **Amber** ≥ 60, **Rose** below — with a one-line "what to fix" note.
  - If a single-layer rewrite would help most, **Apply** writes it into the matching cell.

### The Image cell
A column whose label is "Image" / "Hero" / "Photo" / "Visual" / "Picture" / "Imagery" / "Media" renders as a **MediaCell**. Click *"+ Set image"* (or **Change** on an existing thumb):

- **Library** — pick from this brand's saved references.
- **Upload** — drop a file; saved as a brand reference and selected.
- **Stock** — search Pexels inline, click a result.
- **Generate** — write a one-line photo brief; Gemini renders at 4:5 with the editorial-photography lock baked in (no abstract / CGI / vector).

Whichever you pick, the row's fan-out designs will use that image.

### Generate designs
- **Per row** — the **Designs** column has *"Generate designs"*. Click it; the row fans across the project's formats (1:1, 4:5, 9:16, 16:9 by default).
- **All rows** — *"Generate all designs"* in the header. Capped at 60 designs total.

Each design renders in **brand chrome + the row's copy + the row's image**. Deterministic — no AI image spend per design (the spend is only when you Generate in the MediaCell).

### What happens when you edit a row
- The row's existing designs go **amber (stale)** and lose any approval.
- The Designs column shows *"N stale · Re-render"*.
- Click **↻ Re-render** to refresh that row.

---

## 4 · Design & review

`/campaigns/[id]/designs` · the **Design** step (Review is in here).

Every fan-out design grouped by variation. The group header tells you whether the row's copy is approved yet ("copy approved" / "copy not approved yet" — the first half of the gate).

Per card:
- The rendered preview.
- A state pill: **approved** (emerald), **needs review** (neutral), **needs changes** (amber), or **stale — re-render** (amber, with a link back to the sheet).
- **Approve** / **Needs changes** inline.
- **Edit →** opens the full editor.
- When *row copy approved + design approved + not stale* → the **"ready to ship"** badge appears. That's the gate to Deliverables.

### Editing a single design

Click a design's **Edit →** (`/ads/[id]`).

The preview sits on top. Below it is the **inline copy editor** in brand typography — eyebrow tracked-and-small, **serif headline**, subhead, **CTA →**. Click any line and type.

- **Autosaves** through the row (so the row is always the source of truth).
- A subtle **"Saved to the row ✓"** confirms.
- If the row has other sizes, an amber **"Apply to all sizes"** offers to push the edit to siblings.
- The right panel is just decisions: **Approve / Request revision / Reject / mark Winner**. The "Custom edits" tab has the per-ad overrides (type scale, CTA position, scrim, image crop, brand assets).

---

## 5 · Deliverables

`/campaigns/[id]/deliverables`

Only **ready** designs land here — copy approved AND design approved AND not stale. Standalone creatives (those not fanned from a row) also ship on visual approval alone.

- **Download bundle ↓** — ZIP of approved variants (SVG + PNG + manifest).
- Or pull them into **Figma** with the Augen plugin (installs the plugin; pulls creatives for a brand directly into your Figma file).

If nothing's ready yet, the empty state tells you exactly what's missing.

---

## Driving Augen from Claude Desktop (MCP)

`/settings/mcp` — create a token, then add the MCP server to Claude Desktop / Claude Code.

A typical MCP workflow mirrors the UI:

1. `list_brands` → pick a brand.
2. `list_projects` → pick a project (or `create_project`).
3. `seed_ideas` → Strategist proposes angles.
4. `list_ideas` → review them.
5. `add_idea_to_copy_sheet` → promote an angle to a named row.
6. `get_project_schema` → see column keys + size set.
7. `update_copy_row_cells` → refine the copy.
8. `review_row_copy` → score + fix.
9. `rewrite_cell` → propose a punchier headline.
10. `add_stock_reference` (brand-level Pexels search) → `set_row_image` → attach to the row.
11. `set_copy_row_status` → `approved`.
12. `generate_designs_for_row` → fan out.
13. `view_creative` → see one rendered.
14. `set_creative_status` → `approved`.
15. `list_ready_designs` → confirm the gate.
16. `export_project` → ZIP download URL.

The full tool list lives at `/api/mcp` (description on each call) and in [`lib/mcp/tools.ts`](../lib/mcp/tools.ts).

---

## The Figma plugin

`figma-plugin/` — install from manifest in Figma → Plugins → Development. The plugin pulls approved designs from your Augen instance for the active brand, and round-trips design tokens (Variables → Augen brand tokens). The manifest is locked to the production Railway domain plus `http://localhost:3000` for local dev.

---

## Mental model in one sentence

A project's **rows** are the *what to say*. The **master** (the brand's tokens + the image you pick) is the *how it looks*. **Fan-out** turns rows × sizes into designs. The **gate** ships only what's both — copy approved *and* design approved — and never silently lets edits through stale.
