"use server";
import { updateGenerationStatus } from "@/lib/repo";
import { requireGenerationAccess } from "@/lib/authz";
import { revalidatePath } from "next/cache";

function revalidate(campaignId: string, genId: string) {
  revalidatePath(`/campaigns/${campaignId}/designs`);
  revalidatePath(`/campaigns/${campaignId}/deliverables`);
  revalidatePath(`/campaigns/${campaignId}/copy`);
  revalidatePath(`/ads/${genId}`);
  revalidatePath("/review");
}

// Approve a design's visual (the Review step). A design only ships once its copy
// is approved on the row AND it's approved here AND it isn't stale (#49/#50).
export async function approveDesignAction(campaignId: string, genId: string) {
  const { user } = await requireGenerationAccess(genId);
  updateGenerationStatus(genId, "approved", undefined, user.id);
  revalidate(campaignId, genId);
}

export async function requestChangesDesignAction(campaignId: string, genId: string) {
  const { user } = await requireGenerationAccess(genId);
  updateGenerationStatus(genId, "needs_revision", undefined, user.id);
  revalidate(campaignId, genId);
}
