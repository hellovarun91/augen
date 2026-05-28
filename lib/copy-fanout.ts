import { hashStr } from "./ai/rand";
import { formatBySlug } from "./formats";
import {
  getCampaign, getBrand, getCopyRow, createGeneration, deleteGeneration,
  listDesignsForRow, getProjectSizes, getProjectCopySchema, linkCopyRow, listCopyRows,
  updateGenerationReference, getReference,
} from "./repo";
import { rowToLayerCopy, isMediaColumn } from "./copy-schema";
import type { Generation } from "./types";

const FANOUT_CAP = 60; // safety cap on total designs per "generate all"

// Fan one copy row out across the project's formats: same copy, one design per
// size, all sharing the brand look ("one concept, scaled"). Deterministic — the
// composer renders from brand tokens + a stable seed, no AI spend. Replaces any
// prior fan-out designs for the row (regenerate = a fresh set). Returns the designs.
export function generateDesignsForRow(campaignId: string, rowId: string): Generation[] {
  const campaign = getCampaign(campaignId);
  if (!campaign) throw new Error("Project missing.");
  const row = getCopyRow(rowId);
  if (!row || row.campaign_id !== campaignId) throw new Error("Row not in this project.");
  const brand = getBrand(campaign.brand_id);
  if (!brand) throw new Error("Brand missing.");

  const schema = getProjectCopySchema(campaignId);
  const copy = rowToLayerCopy(schema, row.values);
  if (!copy.headline.trim()) throw new Error("Add a headline to this row before generating designs.");

  const formats = getProjectSizes(campaignId);
  if (!formats.length) throw new Error("This project has no formats enabled.");

  // Replace existing fan-out designs for this row…
  for (const d of listDesignsForRow(rowId)) deleteGeneration(d.id);
  // …and retire a legacy single creative this row was auto-synced from (now superseded).
  if (row.generation_id) { deleteGeneration(row.generation_id); linkCopyRow(rowId, null); }

  const palette = [
    brand.tokens.palette.background, brand.tokens.palette.surface, brand.tokens.palette.foreground,
    brand.tokens.palette.primary, brand.tokens.palette.secondary, brand.tokens.palette.accent,
  ];
  // Per-row image override (#55): if the row has an image-cell value pointing
  // at a brand reference, every design in this fan-out uses it. Otherwise the
  // design renders without a specific reference (composer falls back to SVG).
  const mediaCol = schema.columns.find(isMediaColumn);
  const refId = mediaCol ? (row.values[mediaCol.key] || "").trim() : "";
  const validRef = refId ? getReference(refId) : null;
  const effectiveRefId = validRef && validRef.brand_id === brand.id ? validRef.id : null;

  for (const slug of formats) {
    const fmt = formatBySlug(slug);
    if (!fmt) continue;
    const gen = createGeneration({
      campaignId, ideaId: null, brandId: brand.id,
      formatSlug: slug, aspect: fmt.aspect, width: fmt.width, height: fmt.height,
      headline: copy.headline, subhead: copy.subhead, cta: copy.cta, eyebrow: copy.eyebrow || undefined,
      copy: [{ headline: copy.headline, subhead: copy.subhead, cta: copy.cta, eyebrow: copy.eyebrow || undefined }],
      imagePrompt: row.name || "Copy Sheet variation",
      imageSeed: hashStr(`${rowId}|${slug}`),
      imageStyle: brand.tokens.imagery.style,
      palette,
      confidence: 0.8, costCents: 0,
      copyRowId: rowId,
    });
    if (effectiveRefId) updateGenerationReference(gen.id, effectiveRefId);
  }
  // Return fresh-from-DB designs so callers see post-create updates (e.g. reference_id).
  return listDesignsForRow(rowId);
}

export interface FanoutResult { rows: number; designs: number }

// Fan out every row that has a headline. Skips empties. Capped for safety.
export function generateDesignsForCampaign(campaignId: string): FanoutResult {
  const rows = listCopyRows(campaignId);
  const schema = getProjectCopySchema(campaignId);
  const formats = getProjectSizes(campaignId);
  const fillable = rows.filter((r) => rowToLayerCopy(schema, r.values).headline.trim());
  if (!fillable.length) throw new Error("No rows have a headline yet — write some copy first.");
  if (fillable.length * formats.length > FANOUT_CAP) {
    throw new Error(`That would generate ${fillable.length * formats.length} designs (cap ${FANOUT_CAP}). Trim rows or formats.`);
  }
  let designs = 0;
  for (const r of fillable) designs += generateDesignsForRow(campaignId, r.id).length;
  return { rows: fillable.length, designs };
}
