"use server";
import {
  getCampaign, createCopyRow, updateCopyRow, deleteCopyRow, setProjectCopySchema,
  getCopyRow, linkCopyRow, getProjectCopySchema, getGeneration, updateGenerationCopy,
  listDesignsForRow, listCopyRows, markRowDesignsStale,
} from "@/lib/repo";
import { generateDesignsForRow, generateDesignsForCampaign } from "@/lib/copy-fanout";
import { CopySchema, COPY_ROW_STATUSES, rowToLayerCopy, layerCopyToRowValues } from "@/lib/copy-schema";
import { requireCampaignAccess } from "@/lib/authz";
import { revalidatePath } from "next/cache";

// Slim, serializable view of a design for the client (thumbnail + link + state).
function designLite(d: { id: string; aspect: string; format_slug: string; status: string; stale: number }) {
  return { id: d.id, aspect: d.aspect, format_slug: d.format_slug, status: d.status, stale: d.stale };
}

// Confirms a row belongs to the project — guards every cross-object sync action.
function rowInProject(campaignId: string, rowId: string) {
  const row = getCopyRow(rowId);
  if (!row || row.campaign_id !== campaignId) throw new Error("Row not in this project.");
  return row;
}

export async function addRowAction(campaignId: string, name = "") {
  await requireCampaignAccess(campaignId);
  const c = getCampaign(campaignId);
  if (!c) throw new Error("Project missing");
  const row = createCopyRow(campaignId, c.brand_id, {}, name.trim());
  revalidatePath(`/campaigns/${campaignId}/copy`);
  return row.id;
}

export async function updateRowAction(campaignId: string, rowId: string, values: Record<string, string>) {
  await requireCampaignAccess(campaignId);
  rowInProject(campaignId, rowId);
  updateCopyRow(rowId, { values });
  // Integrity (#49): the row is the source of truth — any design whose copy now
  // diverges goes stale and loses its approval until re-rendered.
  markRowDesignsStale(rowId);
  revalidatePath(`/campaigns/${campaignId}/copy`);
}

// The Name column: labels the variation and names the designs it fans out to (#46).
export async function setRowNameAction(campaignId: string, rowId: string, name: string) {
  await requireCampaignAccess(campaignId);
  rowInProject(campaignId, rowId);
  updateCopyRow(rowId, { name: name.trim().slice(0, 80) });
  revalidatePath(`/campaigns/${campaignId}/copy`);
}

// ---------- #47: row → designs fan-out ----------
// Fan one row's copy across the project's formats. Returns the fresh designs.
export async function generateDesignsAction(campaignId: string, rowId: string) {
  await requireCampaignAccess(campaignId);
  rowInProject(campaignId, rowId);
  const designs = generateDesignsForRow(campaignId, rowId);
  revalidatePath(`/campaigns/${campaignId}/copy`);
  revalidatePath(`/campaigns/${campaignId}`);
  return designs.map(designLite);
}

// Fan out every row that has copy. Returns counts + the new designs per row.
export async function generateAllDesignsAction(campaignId: string) {
  await requireCampaignAccess(campaignId);
  const result = generateDesignsForCampaign(campaignId);
  const byRow: Record<string, ReturnType<typeof designLite>[]> = {};
  for (const row of listCopyRows(campaignId)) {
    const designs = listDesignsForRow(row.id);
    if (designs.length) byRow[row.id] = designs.map(designLite);
  }
  revalidatePath(`/campaigns/${campaignId}/copy`);
  revalidatePath(`/campaigns/${campaignId}`);
  return { ...result, byRow };
}

export async function deleteRowAction(campaignId: string, rowId: string) {
  await requireCampaignAccess(campaignId);
  deleteCopyRow(rowId);
  revalidatePath(`/campaigns/${campaignId}/copy`);
}

export async function saveColumnsAction(campaignId: string, schema: unknown) {
  await requireCampaignAccess(campaignId);
  setProjectCopySchema(campaignId, CopySchema.parse(schema));
  revalidatePath(`/campaigns/${campaignId}/copy`);
}

// ---------- CS4: proof → approve lifecycle ----------
export async function setRowStatusAction(campaignId: string, rowId: string, status: string) {
  await requireCampaignAccess(campaignId);
  rowInProject(campaignId, rowId);
  if (!(COPY_ROW_STATUSES as readonly string[]).includes(status)) throw new Error("Unknown status.");
  updateCopyRow(rowId, { status });
  revalidatePath(`/campaigns/${campaignId}/copy`);
}

// ---------- CS3: row <-> creative link + bidirectional sync ----------
export async function linkRowAction(campaignId: string, rowId: string, generationId: string | null) {
  await requireCampaignAccess(campaignId);
  rowInProject(campaignId, rowId);
  if (generationId) {
    const gen = getGeneration(generationId);
    if (!gen || gen.campaign_id !== campaignId) throw new Error("That creative isn't in this project.");
  }
  linkCopyRow(rowId, generationId);
  revalidatePath(`/campaigns/${campaignId}/copy`);
}

// Pull: creative's current copy → the row's layer-mapped cells.
export async function pullFromCreativeAction(campaignId: string, rowId: string) {
  await requireCampaignAccess(campaignId);
  const row = rowInProject(campaignId, rowId);
  if (!row.generation_id) throw new Error("Link a creative first.");
  const gen = getGeneration(row.generation_id);
  if (!gen || gen.campaign_id !== campaignId) throw new Error("Linked creative is missing.");
  const schema = getProjectCopySchema(campaignId);
  const values = layerCopyToRowValues(schema, row.values, {
    headline: gen.headline || "", subhead: gen.subhead || "", cta: gen.cta || "", eyebrow: gen.eyebrow || "",
  });
  updateCopyRow(rowId, { values });
  revalidatePath(`/campaigns/${campaignId}/copy`);
  return values;
}

// Push (to design): the row's copy → the linked creative's copy layers.
export async function pushToCreativeAction(campaignId: string, rowId: string) {
  await requireCampaignAccess(campaignId);
  const row = rowInProject(campaignId, rowId);
  if (!row.generation_id) throw new Error("Link a creative first.");
  const gen = getGeneration(row.generation_id);
  if (!gen || gen.campaign_id !== campaignId) throw new Error("Linked creative is missing.");
  const schema = getProjectCopySchema(campaignId);
  const copy = rowToLayerCopy(schema, row.values);
  updateGenerationCopy(row.generation_id, copy);
  revalidatePath(`/campaigns/${campaignId}/copy`);
  revalidatePath(`/ads/${row.generation_id}`);
}

// Approve & send to design in one step: mark approved, then push if linked.
export async function approveAndPushAction(campaignId: string, rowId: string) {
  await requireCampaignAccess(campaignId);
  const row = rowInProject(campaignId, rowId);
  updateCopyRow(rowId, { status: "approved" });
  if (row.generation_id) {
    const gen = getGeneration(row.generation_id);
    if (gen && gen.campaign_id === campaignId) {
      const schema = getProjectCopySchema(campaignId);
      updateGenerationCopy(row.generation_id, rowToLayerCopy(schema, row.values));
      revalidatePath(`/ads/${row.generation_id}`);
    }
  }
  revalidatePath(`/campaigns/${campaignId}/copy`);
}
