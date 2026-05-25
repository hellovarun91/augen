"use server";
import { randomUUID } from "crypto";
import { BrandTokens } from "@/lib/types";
import { getBrand, getBrandFigmaUrl, updateBrandFigmaUrl, updateBrandTokens, getFigmaWebhookByBrand, upsertFigmaWebhook, deleteFigmaWebhook, getTokenStage, saveTokenMapping, clearTokenStage } from "@/lib/repo";
import { applyMapping } from "@/lib/figma/token-map";
import { pullVariables, pushVariables, parseFileKey, registerWebhook, deleteWebhookRemote } from "@/lib/figma/sync";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireBrandAccess } from "@/lib/authz";

export async function saveUrlAction(brandId: string, brandSlug: string, url: string) {
  await requireBrandAccess(brandId);
  updateBrandFigmaUrl(brandId, url.trim() || null);
  revalidatePath(`/brands/${brandSlug}/figma`);
}

export async function pullAction(brandId: string, brandSlug: string, url: string) {
  await requireBrandAccess(brandId);
  const result = await pullVariables(url);
  updateBrandFigmaUrl(brandId, url.trim());
  revalidatePath(`/brands/${brandSlug}/figma`);
  return result;
}

export async function pushAction(brandId: string, url: string) {
  await requireBrandAccess(brandId);
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  return pushVariables(url, brand.tokens);
}

export async function applyPulledAction(brandId: string, brandSlug: string, merged: unknown) {
  await requireBrandAccess(brandId);
  const parsed = BrandTokens.parse(merged);
  updateBrandTokens(brandId, parsed);
  revalidatePath(`/brands/${brandSlug}`);
  revalidatePath(`/brands/${brandSlug}/tokens`);
}

// ---------- Live sync (webhooks) ----------

export async function enableLiveSyncAction(brandId: string, brandSlug: string, teamId: string) {
  await requireBrandAccess(brandId);
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  const fileUrl = getBrandFigmaUrl(brandId);
  const fileKey = fileUrl ? parseFileKey(fileUrl) : null;
  if (!fileKey) throw new Error("Set and pull a Figma file first, so we know which file to watch.");
  const team = teamId.trim();
  if (!team) throw new Error("Enter your Figma team ID (Figma → team → the number in the URL).");

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  const endpoint = `${proto}://${host}/api/figma/webhook`;

  // Replace any existing hook so we don't leave orphans on re-enable.
  const existing = getFigmaWebhookByBrand(brandId);
  if (existing) { try { await deleteWebhookRemote(existing.webhook_id); } catch { /* ignore */ } }

  const passcode = randomUUID().replace(/-/g, "");
  const wh = await registerWebhook(team, endpoint, passcode, `Augen · ${brand.name}`);
  upsertFigmaWebhook({ brand_id: brandId, team_id: team, file_key: fileKey, webhook_id: wh.id, passcode, endpoint, active: 1 });
  revalidatePath(`/brands/${brandSlug}/figma`);
}

// Apply the reviewed Figma→Augen token mapping, and remember it for next time.
export async function applyTokenMappingAction(brandId: string, brandSlug: string, mapping: Record<string, string>) {
  await requireBrandAccess(brandId);
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  const stage = getTokenStage(brandId);
  if (!stage) throw new Error("Nothing to apply — pull tokens from the Figma plugin first.");
  const merged = applyMapping(brand.tokens, mapping, stage.vars);
  updateBrandTokens(brandId, merged);
  saveTokenMapping(brandId, mapping); // also clears the staged proposal
  revalidatePath(`/brands/${brandSlug}`);
  revalidatePath(`/brands/${brandSlug}/tokens`);
  revalidatePath(`/brands/${brandSlug}/figma`);
}

export async function discardTokenMappingAction(brandId: string, brandSlug: string) {
  await requireBrandAccess(brandId);
  clearTokenStage(brandId);
  revalidatePath(`/brands/${brandSlug}/figma`);
}

export async function disableLiveSyncAction(brandId: string, brandSlug: string) {
  await requireBrandAccess(brandId);
  const existing = getFigmaWebhookByBrand(brandId);
  if (existing) { try { await deleteWebhookRemote(existing.webhook_id); } catch { /* ignore */ } }
  deleteFigmaWebhook(brandId);
  revalidatePath(`/brands/${brandSlug}/figma`);
}
