"use server";
import { BrandTokens } from "@/lib/types";
import { updateBrandTokens } from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { requireBrandAccess } from "@/lib/authz";

export async function saveTokens(brandId: string, tokens: BrandTokens) {
  await requireBrandAccess(brandId);
  const parsed = BrandTokens.parse(tokens);
  updateBrandTokens(brandId, parsed);
  revalidatePath("/brands/[slug]", "page");
}
