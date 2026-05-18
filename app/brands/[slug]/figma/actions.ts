"use server";
import { BrandTokens } from "@/lib/types";
import { getBrand, updateBrandFigmaUrl, updateBrandTokens } from "@/lib/repo";
import { pullVariables, pushVariables } from "@/lib/figma/sync";
import { revalidatePath } from "next/cache";

export async function saveUrlAction(brandId: string, brandSlug: string, url: string) {
  updateBrandFigmaUrl(brandId, url.trim() || null);
  revalidatePath(`/brands/${brandSlug}/figma`);
}

export async function pullAction(brandId: string, brandSlug: string, url: string) {
  // Save the URL on first successful pull
  const result = await pullVariables(url);
  updateBrandFigmaUrl(brandId, url.trim());
  revalidatePath(`/brands/${brandSlug}/figma`);
  return result;
}

export async function pushAction(brandId: string, url: string) {
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  return pushVariables(url, brand.tokens);
}

export async function applyPulledAction(brandId: string, brandSlug: string, merged: unknown) {
  const parsed = BrandTokens.parse(merged);
  updateBrandTokens(brandId, parsed);
  revalidatePath(`/brands/${brandSlug}`);
  revalidatePath(`/brands/${brandSlug}/tokens`);
}
