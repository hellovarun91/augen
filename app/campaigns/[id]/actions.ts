"use server";
import { generateAdsViaAgents, strategistOnly } from "@/lib/agents/orchestrator";
import { getBrand, getCampaign, upsertCampaignFormat } from "@/lib/repo";
import { db, nowMs } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function saveFormatLabelAction(campaignId: string, formatSlug: string, label: string | null) {
  upsertCampaignFormat({ campaignId, formatSlug, label: label?.trim() || null });
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function runCampaignAction(campaignId: string, copyConstraint?: string) {
  const c = getCampaign(campaignId);
  if (!c) throw new Error("Campaign missing");
  const b = getBrand(c.brand_id);
  if (!b) throw new Error("Brand missing");
  const variantsPerFormat = c.brief.notes?.match(/variants:(\d+)/)?.[1];
  const v = variantsPerFormat ? parseInt(variantsPerFormat, 10) : 1;
  const result = await generateAdsViaAgents({
    campaignId,
    brand: b,
    brief: c.brief,
    variantsPerFormat: v,
    copyConstraint,
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/agents`);
  revalidatePath("/review");
  return result;
}

export async function runStrategistAction(campaignId: string, opts: { count: number; notes?: string }) {
  const c = getCampaign(campaignId);
  if (!c) throw new Error("Campaign missing");
  const b = getBrand(c.brand_id);
  if (!b) throw new Error("Brand missing");
  const result = await strategistOnly({
    campaignId,
    brand: b,
    brief: c.brief,
    language: b.language,
    quarter: c.quarter || undefined,
    year: c.year || undefined,
    count: opts.count,
    notes: opts.notes,
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/agents`);
  return result;
}

export async function saveBriefAction(campaignId: string, patch: {
  audience: string;
  notes: string;
  formats: string[];
  variantsPerFormat: number;
}) {
  const c = getCampaign(campaignId);
  if (!c) throw new Error("Campaign missing");
  const brief = { ...c.brief, formats: patch.formats, notes: `${patch.notes}\n[variants:${patch.variantsPerFormat}]` };
  db().prepare("UPDATE campaigns SET audience = ?, brief = ?, updated_at = ? WHERE id = ?").run(
    patch.audience, JSON.stringify(brief), nowMs(), campaignId,
  );
  revalidatePath(`/campaigns/${campaignId}`);
}
