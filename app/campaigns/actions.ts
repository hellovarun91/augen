"use server";
import { createCampaign, deleteCampaign, updateCampaignBasics } from "@/lib/repo";
import { requireBrandAccess, requireCampaignAccess } from "@/lib/authz";
import { defaultFormatSlugs } from "@/lib/formats";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createProjectAction(brandId: string, input: { name: string; objective: string; audience: string }) {
  await requireBrandAccess(brandId);
  const c = createCampaign({
    brandId,
    name: input.name.trim() || "Untitled project",
    objective: input.objective.trim() || undefined,
    audience: input.audience.trim() || undefined,
    brief: {
      objective: input.objective.trim(),
      audience: input.audience.trim(),
      productFocus: [],
      channels: [],
      formats: defaultFormatSlugs(),
      budget: 0,
      kpis: [],
      notes: "",
    },
  });
  revalidatePath("/campaigns");
  redirect(`/campaigns/${c.id}`);
}

export async function renameProjectAction(campaignId: string, name: string) {
  await requireCampaignAccess(campaignId);
  updateCampaignBasics(campaignId, { name });
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function deleteProjectAction(campaignId: string) {
  await requireCampaignAccess(campaignId);
  deleteCampaign(campaignId);
  revalidatePath("/campaigns");
}
