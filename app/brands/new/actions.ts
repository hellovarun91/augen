"use server";
import { synthesizeBrandAI } from "@/lib/ai/brand-synth";
import { createBrand, createCampaign, createIdea, getBrandBySlug } from "@/lib/repo";
import { planQuarter, plannedToBrief } from "@/lib/ai/planner";
import { slugify } from "@/lib/utils";
import { redirect } from "next/navigation";
import { addMembership, getCurrentUserId } from "@/lib/users";
import { setActiveBrand } from "@/lib/session";
import { fetchSiteText, mergeBriefWithSite } from "@/lib/ingest/url";
import { BrandTokens as BrandTokensSchema } from "@/lib/types";
import type { BrandSynth } from "@/lib/ai/brand-builder";

// Phase 1 — synthesize a foundation for REVIEW, without committing anything.
// Reads the typed brief and (optionally) a website URL whose text is folded in.
// Returns a plain object the client renders and lets the user tweak before
// confirming. The deterministic builder is the fallback when no AI key.
export async function synthesizeBrandPreview(input: { brief: string; url?: string; name?: string }): Promise<{
  synth: BrandSynth;
  sourcedFromUrl: boolean;
}> {
  const brief = (input.brief || "").trim();
  const url = (input.url || "").trim();
  if (brief.length < 16 && !url) throw new Error("Give us a sentence about the brand, or a website to read.");

  const site = url ? await fetchSiteText(url) : null;
  const merged = mergeBriefWithSite(brief || "A brand. Synthesize an identity from the website.", site);
  const overrideName = (input.name || "").trim();
  const synth = await synthesizeBrandAI(merged, overrideName ? { name: overrideName, slug: slugify(overrideName) } : undefined);
  return { synth, sourcedFromUrl: !!site };
}

// Phase 2 — commit the (possibly edited) foundation. Validates the tokens the
// client sends back, de-dupes the slug, grants owner membership, and optionally
// auto-drafts a quarter of projects.
export async function confirmBrand(payload: {
  name: string;
  tagline: string;
  industry: string;
  description: string;
  tokens: unknown;
  autoDraft: "next" | "none";
}) {
  const name = (payload.name || "").trim();
  if (!name) throw new Error("Brand needs a name.");
  const tokens = BrandTokensSchema.parse({ ...(payload.tokens as object), name });

  let slug = slugify(name);
  const base = slug;
  let n = 2;
  while (getBrandBySlug(slug)) slug = `${base}-${n++}`;

  const brand = createBrand({
    name,
    slug,
    tagline: payload.tagline?.trim() || "",
    industry: payload.industry?.trim() || "lifestyle",
    description: payload.description?.trim() || "",
    tokens,
  });

  const uid = await getCurrentUserId();
  if (uid) {
    addMembership(uid, brand.id, "owner");
    await setActiveBrand(brand.id);
  }

  if (payload.autoDraft === "next") {
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
