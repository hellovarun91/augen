"use server";
import { getBrand, updateBrandTokens } from "@/lib/repo";
import { requireBrandAccess } from "@/lib/authz";
import { refineBrandAI } from "@/lib/ai/brand-refine";
import { BrandTokens as BrandTokensSchema } from "@/lib/types";
import { revalidatePath } from "next/cache";

// Propose a refinement (no write). Returns the revised tokens + a summary so the
// client can preview the change before committing.
export async function previewRefineAction(brandId: string, instruction: string): Promise<{
  tokens: unknown; summary: string; viaAI: boolean;
}> {
  await requireBrandAccess(brandId);
  const ins = (instruction || "").trim();
  if (ins.length < 2) throw new Error("Tell Augen what to change.");
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand not found.");
  const { tokens, summary, viaAI } = await refineBrandAI(brand, ins);
  return { tokens, summary, viaAI };
}

// Commit a previewed refinement.
export async function applyRefineAction(brandId: string, tokens: unknown) {
  await requireBrandAccess(brandId);
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand not found.");
  const parsed = BrandTokensSchema.parse({ ...(tokens as object), name: brand.tokens.name });
  updateBrandTokens(brandId, parsed);
  revalidatePath(`/brands/${brand.slug}`);
}
