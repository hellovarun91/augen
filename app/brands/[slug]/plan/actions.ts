"use server";
import { planQuarter, plannedToBrief } from "@/lib/ai/planner";
import { createCampaign, createIdea, getBrand } from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBrandAccess } from "@/lib/authz";

export async function acceptPlan(brandId: string, quarter: string, year: number) {
  await requireBrandAccess(brandId);
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand not found");
  const planned = planQuarter(brand, year, quarter as "Q1" | "Q2" | "Q3" | "Q4");
  for (const p of planned) {
    const campaign = createCampaign({
      brandId: brand.id,
      name: p.name,
      quarter: p.quarter,
      year: p.year,
      objective: p.objective,
      audience: p.audience,
      brief: plannedToBrief(p),
    });
    let idx = 0;
    for (const idea of p.ideas) {
      createIdea({
        campaignId: campaign.id,
        theme: idea.theme,
        insight: idea.insight,
        angle: idea.angle,
        audience: idea.audience,
        promise: idea.promise,
        hooks: idea.hooks,
        visualDirection: idea.visualDirection,
        orderIdx: idx++,
      });
    }
  }
  revalidatePath(`/brands/${brand.slug}`);
  redirect(`/brands/${brand.slug}`);
}
