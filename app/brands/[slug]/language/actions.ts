"use server";
import { BrandLanguage } from "@/lib/types";
import { getBrand, updateBrandLanguage } from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { runCritic } from "@/lib/agents/critic";

export async function saveLanguage(brandId: string, language: BrandLanguage) {
  const parsed = BrandLanguage.parse(language);
  updateBrandLanguage(brandId, parsed);
  revalidatePath("/brands/[slug]/language", "page");
  revalidatePath("/brands/[slug]", "page");
}

export async function criticPreview(
  brandId: string,
  language: BrandLanguage,
  copy: { headline: string; subhead: string; cta: string; eyebrow?: string },
  formatSlug: string,
) {
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  const parsedLang = BrandLanguage.parse(language);
  const { output } = await runCritic({
    brand,
    language: parsedLang,
    formatSlug,
    copy: { eyebrow: copy.eyebrow || "", headline: copy.headline, subhead: copy.subhead, cta: copy.cta },
  });
  return {
    score: output.score,
    voiceFit: output.voiceFit,
    formatFit: output.formatFit,
    conceptStrength: output.conceptStrength,
    verdict: output.verdict,
    notes: output.notes,
  };
}
