"use server";
import { BrandTokens } from "@/lib/types";
import { updateBrandTokens } from "@/lib/repo";
import { extractTokensFromImage } from "@/lib/agents/token-extractor";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBrandAccess } from "@/lib/authz";
import { chargeCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/ratelimit";

const MAX_UPLOAD = 12 * 1024 * 1024;

export async function extractTokensAction(brandId: string, fd: FormData) {
  const user = await requireBrandAccess(brandId);
  await rateLimit(user.id, "token_extract", { perMinute: 5 });
  const file = fd.get("file") as File | null;
  if (!file || !file.size) throw new Error("Pick an image");
  if (file.size > MAX_UPLOAD) throw new Error("Image too large (max 12MB)");
  if (!/^image\//.test(file.type || "")) throw new Error("File must be an image");
  chargeCredits({ userId: user.id, action: "token_extract", description: "Token extraction", refId: brandId });
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
  await requireBrandAccess(brandId);
  const parsed = BrandTokens.parse(tokens);
  updateBrandTokens(brandId, parsed);
  revalidatePath(`/brands/${brandSlug}`);
  redirect(`/brands/${brandSlug}/tokens`);
}
