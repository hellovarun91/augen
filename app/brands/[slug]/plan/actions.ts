"use server";
import { createCampaign, createIdea, getBrand } from "@/lib/repo";
import { defaultFormatSlugs } from "@/lib/formats";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBrandAccess } from "@/lib/authz";

export interface PlanPick {
  name: string;
  objective: string;
  audience: string;
  productFocus: string[];
  ideas: Array<{ theme: string; insight: string; angle: string; audience: string; promise: string; hooks: string[]; visualDirection: string }>;
}

// Create the projects the operator selected (and possibly renamed) from the
// planner's drafts — not the whole batch. Money fields stay out of the brief.
export async function addPlannedProjects(brandId: string, picks: PlanPick[]) {
  await requireBrandAccess(brandId);
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand not found");
  if (!picks.length) return;
  for (const p of picks) {
    const campaign = createCampaign({
      brandId: brand.id,
      name: p.name.trim() || "Untitled project",
      objective: p.objective,
      audience: p.audience,
      brief: { objective: p.objective, audience: p.audience, productFocus: p.productFocus || [], channels: [], formats: defaultFormatSlugs(), budget: 0, kpis: [], notes: "" },
    });
    let idx = 0;
    for (const idea of (p.ideas || [])) {
      createIdea({
        campaignId: campaign.id,
        theme: idea.theme, insight: idea.insight, angle: idea.angle,
        audience: idea.audience, promise: idea.promise, hooks: idea.hooks,
        visualDirection: idea.visualDirection, orderIdx: idx++,
      });
    }
  }
  revalidatePath("/campaigns");
  revalidatePath(`/brands/${brand.slug}`);
  redirect("/campaigns");
}
