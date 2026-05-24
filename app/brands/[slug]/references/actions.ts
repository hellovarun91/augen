"use server";
import { createReference, deleteReference, getBrand, getReference, toggleReferenceSelected } from "@/lib/repo";
import { generateImage, saveBytes, saveUploadedImage, searchStock } from "@/lib/images/providers";
import { revalidatePath } from "next/cache";
import { requireBrandAccess } from "@/lib/authz";
import { chargeCredits } from "@/lib/credits";
import { rateLimit } from "@/lib/ratelimit";
import { recordSpend } from "@/lib/spend";
import { imagePriceMicros } from "@/lib/agents/pricing";

const MAX_UPLOAD = 12 * 1024 * 1024;

export async function uploadRefAction(brandId: string, fd: FormData) {
  await requireBrandAccess(brandId);
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  const file = fd.get("file") as File | null;
  const label = String(fd.get("label") || "").trim() || null;
  if (!file || !file.size) throw new Error("Pick a file");
  if (file.size > MAX_UPLOAD) throw new Error("File too large (max 12MB)");
  if (!/^image\//.test(file.type || "")) throw new Error("File must be an image");
  const buf = Buffer.from(await file.arrayBuffer());
  const saved = await saveUploadedImage(brand.slug, { name: file.name, mime: file.type || "image/jpeg", bytes: buf });
  createReference({
    brandId, kind: "upload", source: "upload",
    label: label || file.name,
    filePath: saved.publicPath, mime: saved.mime,
    tags: [], palette: [],
  });
  revalidatePath(`/brands/${brand.slug}/references`);
}

export async function stockSearchAction(brandId: string, fd: FormData) {
  const user = await requireBrandAccess(brandId);
  await rateLimit(user.id, "stock_search", { perMinute: 10 });
  chargeCredits({ userId: user.id, action: "stock_search", description: "Stock search", refId: brandId });
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  const query = String(fd.get("query") || "").trim();
  const orientation = (String(fd.get("orientation") || "landscape") as "landscape" | "portrait" | "square");
  const label = String(fd.get("label") || "").trim() || null;
  if (!query) throw new Error("Query required");
  const result = await searchStock(query, orientation);
  if (!result) throw new Error("Stock search returned nothing (or PEXELS_API_KEY missing)");
  recordSpend({ userId: user.id, brandId, provider: "pexels", category: "stock", model: "pexels", qty: 1, costMicros: 0, meta: { query } });
  const saved = await saveBytes(brand.slug, result.bytes, result.mime);
  createReference({
    brandId, kind: "stock", source: "pexels",
    label: label || `Stock: ${query}`,
    prompt: query,
    filePath: saved.publicPath, mime: result.mime,
    width: result.width, height: result.height,
    tags: [orientation, "pexels", result.attribution],
    palette: [],
  });
  revalidatePath(`/brands/${brand.slug}/references`);
}

export async function generateRefAction(brandId: string, brandSlug: string, fd: FormData) {
  const user = await requireBrandAccess(brandId);
  await rateLimit(user.id, "image_generate", { perMinute: 5 });
  chargeCredits({ userId: user.id, action: "image_generate", description: "Generate reference image", refId: brandId });
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  const prompt = String(fd.get("prompt") || "").trim();
  const aspect = String(fd.get("aspect") || "4:5");
  if (!prompt) throw new Error("Prompt required");
  const result = await generateImage(`${prompt} — brand: ${brand.name}. Style: ${brand.tokens.imagery.style}. ${brand.tokens.imagery.treatment}`, aspect);
  if (!result) throw new Error("Generation returned nothing (or GEMINI_API_KEY missing / endpoint not yet GA)");
  recordSpend({ userId: user.id, brandId, provider: "gemini", category: "image", model: result.source, qty: 1, costMicros: imagePriceMicros() });
  const saved = await saveBytes(brand.slug, result.bytes, result.mime);
  createReference({
    brandId, kind: "generated", source: "gemini",
    label: prompt.slice(0, 64),
    prompt,
    filePath: saved.publicPath, mime: result.mime,
    width: result.width, height: result.height,
    tags: [aspect, "gemini"],
    palette: [],
  });
  revalidatePath(`/brands/${brandSlug}/references`);
}

export async function toggleSelectedAction(refId: string, selected: boolean) {
  const ref = getReference(refId);
  if (!ref) throw new Error("Reference missing");
  await requireBrandAccess(ref.brand_id);
  toggleReferenceSelected(refId, selected);
  revalidatePath("/brands/[slug]/references", "page");
}

export async function deleteRefAction(refId: string) {
  const ref = getReference(refId);
  if (!ref) throw new Error("Reference missing");
  await requireBrandAccess(ref.brand_id);
  deleteReference(refId);
  revalidatePath("/brands/[slug]/references", "page");
}
