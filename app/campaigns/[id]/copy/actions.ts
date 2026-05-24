"use server";
import { getCampaign, createCopyRow, updateCopyRow, deleteCopyRow, setProjectCopySchema } from "@/lib/repo";
import { CopySchema } from "@/lib/copy-schema";
import { requireCampaignAccess } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function addRowAction(campaignId: string) {
  await requireCampaignAccess(campaignId);
  const c = getCampaign(campaignId);
  if (!c) throw new Error("Project missing");
  const row = createCopyRow(campaignId, c.brand_id, {});
  revalidatePath(`/campaigns/${campaignId}/copy`);
  return row.id;
}

export async function updateRowAction(campaignId: string, rowId: string, values: Record<string, string>) {
  await requireCampaignAccess(campaignId);
  updateCopyRow(rowId, { values });
  revalidatePath(`/campaigns/${campaignId}/copy`);
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
