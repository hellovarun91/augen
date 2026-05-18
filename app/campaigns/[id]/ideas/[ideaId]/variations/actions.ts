"use server";
import { createVariationBatch, parseCsvVariations, type Strategy, type VariationSlots } from "@/lib/variations";
import { getBrand } from "@/lib/repo";
import { requireIdeaAccess } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function createMatrixBatchAction(
  campaignId: string,
  ideaId: string,
  opts: { name: string; strategy: Strategy; slots: VariationSlots; formats: string[] },
) {
  const { user, idea, campaign } = await requireIdeaAccess(ideaId);
  if (idea.campaign_id !== campaignId) throw new Error("Idea mismatch");
  const brand = getBrand(campaign.brand_id);
  if (!brand) throw new Error("Brand missing");
  const result = createVariationBatch({
    brand, idea, campaignId,
    name: opts.name,
    strategy: opts.strategy,
    slots: opts.slots,
    formats: opts.formats,
  });
  revalidatePath(`/campaigns/${campaignId}/ideas/${ideaId}/variations`);
  revalidatePath(`/campaigns/${campaignId}`);
  return result;
}

export async function createCsvBatchAction(
  campaignId: string,
  ideaId: string,
  opts: { name: string; csv: string; formats: string[] },
) {
  const { idea, campaign } = await requireIdeaAccess(ideaId);
  if (idea.campaign_id !== campaignId) throw new Error("Idea mismatch");
  const brand = getBrand(campaign.brand_id);
  if (!brand) throw new Error("Brand missing");
  const combos = parseCsvVariations(opts.csv);
  if (combos.length === 0) throw new Error("CSV produced no valid rows");
  // Pack combos as zipped slots so the engine fans them out one-to-one.
  const slots: VariationSlots = {
    headline: combos.map((c) => c.headline),
    subhead: combos.map((c) => c.subhead),
    cta: combos.map((c) => c.cta),
    eyebrow: combos.map((c) => c.eyebrow),
    imageRefIds: combos.map((c) => c.imageRefId),
  };
  const result = createVariationBatch({
    brand, idea, campaignId,
    name: opts.name,
    strategy: "csv",
    slots,
    formats: opts.formats,
  });
  // Override strategy to zip for engine but record as csv
  // (handled inside createVariationBatch by treating "csv" same as a zip — let's check)
  revalidatePath(`/campaigns/${campaignId}/ideas/${ideaId}/variations`);
  return result;
}

export async function deleteBatchAction(batchId: string, campaignId: string, ideaId: string) {
  // Ensure access via the idea
  await requireIdeaAccess(ideaId);
  const { deleteVariationBatch } = await import("@/lib/variations");
  deleteVariationBatch(batchId);
  revalidatePath(`/campaigns/${campaignId}/ideas/${ideaId}/variations`);
}
