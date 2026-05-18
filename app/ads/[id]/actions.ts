"use server";
import {
  updateGenerationStatus, updateGenerationCopy, setGenerationWinner,
  getBrand, getGenerationOverrides, updateGenerationOverrides,
} from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { AdOverrides, mergeOverrides, parseOverrides } from "@/lib/composer/overrides";
import { saveUploadedImage } from "@/lib/images/providers";
import { requireGenerationAccess } from "@/lib/authz";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export async function toggleWinnerAction(id: string, on: boolean) {
  await requireGenerationAccess(id);
  setGenerationWinner(id, on);
  revalidatePath(`/ads/${id}`);
}

export async function saveOverridesAction(id: string, patch: unknown) {
  await requireGenerationAccess(id);
  const current = parseOverrides(getGenerationOverrides(id));
  const merged = mergeOverrides(current, patch);
  updateGenerationOverrides(id, merged);
  revalidatePath(`/ads/${id}`);
}

export async function clearOverridesAction(id: string) {
  await requireGenerationAccess(id);
  updateGenerationOverrides(id, null);
  revalidatePath(`/ads/${id}`);
}

export async function replaceImageAction(id: string, fd: FormData) {
  const { generation: gen } = await requireGenerationAccess(id);
  const file = fd.get("file") as File | null;
  if (!file || !file.size) throw new Error("Pick an image");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image too large (max 12MB)");
  if (!/^image\//.test(file.type || "")) throw new Error("File must be an image");
  const brand = getBrand(gen.brand_id);
  if (!brand) throw new Error("Brand missing");
  const buf = Buffer.from(await file.arrayBuffer());
  const saved = await saveUploadedImage(brand.slug, { name: file.name, mime: file.type || "image/jpeg", bytes: buf });
  const transparent = file.type === "image/png" && String(fd.get("transparent")) === "1";
  const current = parseOverrides(getGenerationOverrides(id));
  const merged = mergeOverrides(current, { image: { replaceUrl: saved.publicPath, transparent } });
  updateGenerationOverrides(id, merged);
  revalidatePath(`/ads/${id}`);
}

export async function removeReplacedImageAction(id: string) {
  await requireGenerationAccess(id);
  const current = parseOverrides(getGenerationOverrides(id));
  const merged: AdOverrides = { ...current, image: { ...current.image, replaceUrl: undefined, transparent: false } };
  updateGenerationOverrides(id, merged);
  revalidatePath(`/ads/${id}`);
}

export async function approveAd(id: string, note?: string) {
  await requireGenerationAccess(id);
  updateGenerationStatus(id, "approved", note);
  revalidatePath(`/ads/${id}`);
  revalidatePath("/review");
}
export async function rejectAd(id: string, note?: string) {
  await requireGenerationAccess(id);
  updateGenerationStatus(id, "rejected", note);
  revalidatePath(`/ads/${id}`);
  revalidatePath("/review");
}
export async function requestRevision(id: string, note?: string) {
  await requireGenerationAccess(id);
  updateGenerationStatus(id, "needs_revision", note);
  revalidatePath(`/ads/${id}`);
  revalidatePath("/review");
}
export async function saveCopy(id: string, copy: { headline: string; subhead: string; cta: string; eyebrow: string }) {
  await requireGenerationAccess(id);
  updateGenerationCopy(id, { headline: copy.headline, subhead: copy.subhead, cta: copy.cta, eyebrow: copy.eyebrow || undefined });
  revalidatePath(`/ads/${id}`);
}
