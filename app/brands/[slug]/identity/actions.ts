"use server";
import { updateBrandFields } from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { requireBrandAccess } from "@/lib/authz";

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
