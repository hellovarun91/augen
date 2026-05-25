"use server";
import { updateBrandFields, deleteBrand, brandRole } from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBrandAccess } from "@/lib/authz";
import { setActiveBrand } from "@/lib/session";

export async function saveIdentityAction(
  brandId: string,
  patch: { name: string; tagline: string; industry: string; description: string },
) {
  await requireBrandAccess(brandId);
  updateBrandFields(brandId, {
    name: patch.name.trim() || undefined,        // never blank the name
    tagline: patch.tagline.trim(),
    industry: patch.industry.trim(),
    description: patch.description.trim(),
  });
  // Slug is intentionally stable on rename so existing links never break.
  revalidatePath("/brands/[slug]", "page");
  revalidatePath("/");
}

// Permanently delete a brand and everything under it. Owner-only.
export async function deleteBrandAction(brandId: string) {
  const user = await requireBrandAccess(brandId);
  if (brandRole(user.id, brandId) !== "owner") throw new Error("Only the brand owner can delete it.");
  deleteBrand(brandId);
  try { await setActiveBrand(null as any); } catch { /* best effort */ }
  revalidatePath("/");
  redirect("/");
}
