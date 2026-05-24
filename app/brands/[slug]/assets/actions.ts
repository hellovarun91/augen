"use server";
import { createAsset, deleteAsset, getAsset, getBrand, setAssetRole, type AssetKind, type AssetRole } from "@/lib/repo";
import { saveUploadedImage, sanitizeSvg } from "@/lib/images/providers";
import { revalidatePath } from "next/cache";
import { requireBrandAccess } from "@/lib/authz";

const MAX = 6 * 1024 * 1024;
const ALLOWED = /^image\/(png|jpe?g|webp|svg\+xml|gif)$/;

export async function uploadAssetAction(brandId: string, fd: FormData) {
  await requireBrandAccess(brandId);
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  const file = fd.get("file") as File | null;
  const kind = (String(fd.get("kind") || "logo")) as AssetKind;
  const label = String(fd.get("label") || "").trim() || null;
  if (!file || !file.size) throw new Error("Pick a file");
  if (file.size > MAX) throw new Error("File too large (max 6MB)");
  const mime = file.type || "";
  if (!ALLOWED.test(mime)) throw new Error("Use SVG, PNG, JPG, WEBP, or GIF");

  let bytes = Buffer.from(await file.arrayBuffer());
  if (mime.includes("svg")) bytes = Buffer.from(sanitizeSvg(bytes.toString("utf8")), "utf8");
  const saved = await saveUploadedImage(brand.slug, { name: file.name, mime, bytes });
  createAsset({ brandId, kind, label: label || file.name, filePath: saved.publicPath, mime });
  revalidatePath(`/brands/${brand.slug}/assets`);
}

export async function deleteAssetAction(assetId: string, brandSlug: string) {
  const a = getAsset(assetId);
  if (!a) return;
  await requireBrandAccess(a.brand_id);
  deleteAsset(assetId);
  revalidatePath(`/brands/${brandSlug}/assets`);
}

export async function setAssetRoleAction(assetId: string, role: AssetRole, brandSlug: string) {
  const a = getAsset(assetId);
  if (!a) return;
  await requireBrandAccess(a.brand_id);
  setAssetRole(assetId, role);
  revalidatePath(`/brands/${brandSlug}/assets`);
  revalidatePath(`/brands/${brandSlug}`);
}
