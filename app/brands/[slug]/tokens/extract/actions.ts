"use server";
import { BrandTokens } from "@/lib/types";
import { updateBrandTokens } from "@/lib/repo";
import { extractTokensFromImage } from "@/lib/agents/token-extractor";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function extractTokensAction(brandId: string, fd: FormData) {
  const file = fd.get("file") as File | null;
  if (!file || !file.size) throw new Error("Pick an image");
  const buf = Buffer.from(await file.arrayBuffer());
  const r = await extractTokensFromImage({
    imageBytes: buf,
    mime: (file.type || "image/jpeg") as string,
    brandHintName: String(fd.get("brandName") || ""),
    brandHintIndustry: String(fd.get("industry") || ""),
  });
  return r;
}

export async function applyExtractedTokensAction(brandId: string, brandSlug: string, tokens: unknown) {
  const parsed = BrandTokens.parse(tokens);
  updateBrandTokens(brandId, parsed);
  revalidatePath(`/brands/${brandSlug}`);
  redirect(`/brands/${brandSlug}/tokens`);
}
