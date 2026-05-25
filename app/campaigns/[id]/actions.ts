"use server";
import { generateAdsViaAgents, strategistOnly } from "@/lib/agents/orchestrator";
import { getBrand, getCampaign, upsertCampaignFormat, signOffCampaign, clearCampaignSignoff } from "@/lib/repo";
import { db, nowMs } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireCampaignAccess } from "@/lib/authz";
import { chargeCredits, quoteCost, refundCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/ratelimit";
import { track } from "@/lib/analytics";

export async function saveFormatLabelAction(campaignId: string, formatSlug: string, label: string | null) {
  await requireCampaignAccess(campaignId);
  upsertCampaignFormat({ campaignId, formatSlug, label: label?.trim() || null });
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function runCampaignAction(campaignId: string, copyConstraint?: string) {
  const { user, campaign: c } = await requireCampaignAccess(campaignId);
  await rateLimit(user.id, "generate_ads", { perMinute: 3 });
  const b = getBrand(c.brand_id);
  if (!b) throw new Error("Brand missing");
  const variantsPerFormat = c.brief.notes?.match(/variants:(\d+)/)?.[1];
  const v = variantsPerFormat ? parseInt(variantsPerFormat, 10) : 1;

  const t0 = Date.now();
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  const baseUrl = host ? `${proto}://${host}` : undefined;
  const result = await generateAdsViaAgents({
    campaignId,
    brand: b,
    brief: c.brief,
    variantsPerFormat: v,
    copyConstraint,
    userId: user.id,
    baseUrl,
  });
  void track(user.id, "generate_ads", {
    campaign_id: campaignId, brand_id: b.id,
    ads_count: result.generations, latency_ms: Date.now() - t0,
    has_constraint: !!copyConstraint, variants_per_format: v,
  });

  // Charge after we know how many ads landed.
  const adsActual = result.generations;
  if (adsActual > 0) {
    chargeCredits({ userId: user.id, action: "generate_ad_claude", units: adsActual, description: `${adsActual} ads`, refId: campaignId });
    if (process.env.GEMINI_API_KEY) {
      chargeCredits({ userId: user.id, action: "generate_ad_image", units: adsActual, description: `Image gen ×${adsActual}`, refId: campaignId });
    }
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/agents`);
  revalidatePath("/review");
  return result;
}

export async function runStrategistAction(campaignId: string, opts: { count: number; notes?: string }) {
  const { user, campaign: c } = await requireCampaignAccess(campaignId);
  await rateLimit(user.id, "strategist", { perMinute: 5 });
  const b = getBrand(c.brand_id);
  if (!b) throw new Error("Brand missing");
  chargeCredits({ userId: user.id, action: "strategist", description: "Strategist run", refId: campaignId });
  const result = await strategistOnly({
    campaignId,
    brand: b,
    brief: c.brief,
    language: b.language,
    quarter: c.quarter || undefined,
    year: c.year || undefined,
    count: opts.count,
    notes: opts.notes,
    userId: user.id,
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/agents`);
  return result;
}

export async function signOffProjectAction(campaignId: string) {
  const { user } = await requireCampaignAccess(campaignId);
  signOffCampaign(campaignId, user.id);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/review");
}

export async function reopenProjectAction(campaignId: string) {
  await requireCampaignAccess(campaignId);
  clearCampaignSignoff(campaignId);
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/review");
}

export async function saveBriefAction(campaignId: string, patch: {
  audience: string;
  notes: string;
  formats: string[];
  variantsPerFormat: number;
}) {
  const { campaign: c } = await requireCampaignAccess(campaignId);
  const brief = { ...c.brief, formats: patch.formats, notes: `${patch.notes}\n[variants:${patch.variantsPerFormat}]` };
  db().prepare("UPDATE campaigns SET audience = ?, brief = ?, updated_at = ? WHERE id = ?").run(
    patch.audience, JSON.stringify(brief), nowMs(), campaignId,
  );
  revalidatePath(`/campaigns/${campaignId}`);
}
