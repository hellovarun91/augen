"use server";
import { synthesizeBrandAI } from "@/lib/ai/brand-synth";
import { createBrand, createCampaign, createIdea, getBrandBySlug } from "@/lib/repo";
import { planQuarter, plannedToBrief } from "@/lib/ai/planner";
import { slugify } from "@/lib/utils";
import { redirect } from "next/navigation";
import { addMembership, getCurrentUserId } from "@/lib/users";
import { setActiveBrand } from "@/lib/session";

export async function onboardBrand(fd: FormData) {
  const brief = String(fd.get("brief") || "").trim();
  const overrideName = String(fd.get("name") || "").trim();
  const autoDraft = String(fd.get("autoDraft") || "next");
  if (brief.length < 16) throw new Error("Brief is too short — give us a sentence at least.");

  const synth = await synthesizeBrandAI(brief, overrideName ? { name: overrideName, slug: slugify(overrideName) } : undefined);

  // De-duplicate slug
  let slug = synth.slug;
  let n = 2;
  while (getBrandBySlug(slug)) {
    slug = `${synth.slug}-${n++}`;
  }

  const brand = createBrand({
    name: synth.name,
    slug,
    tagline: synth.tagline,
    industry: synth.industry,
    description: synth.description,
    tokens: synth.tokens,
  });

  // Grant the creator owner-membership
  const uid = await getCurrentUserId();
  if (uid) {
    addMembership(uid, brand.id, "owner");
    await setActiveBrand(brand.id);
  }

  if (autoDraft === "next") {
    const now = new Date();
    const q = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
    const next = (q === 4 ? 1 : q + 1) as 1 | 2 | 3 | 4;
    const year = next === 1 && q === 4 ? now.getFullYear() + 1 : now.getFullYear();
    const planned = planQuarter(brand, year, `Q${next}` as "Q1" | "Q2" | "Q3" | "Q4");
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
  }

  redirect(`/brands/${brand.slug}`);
}
