"use server";
import {
  updateGenerationStatus, updateGenerationCopy, setGenerationWinner,
  getBrand, getGeneration, getGenerationOverrides, updateGenerationOverrides,
} from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { AdOverrides, mergeOverrides, parseOverrides } from "@/lib/composer/overrides";
import { saveUploadedImage } from "@/lib/images/providers";

export async function toggleWinnerAction(id: string, on: boolean) {
  setGenerationWinner(id, on);
  revalidatePath(`/ads/${id}`);
}

export async function saveOverridesAction(id: string, patch: unknown) {
  const current = parseOverrides(getGenerationOverrides(id));
  const merged = mergeOverrides(current, patch);
  updateGenerationOverrides(id, merged);
  revalidatePath(`/ads/${id}`);
}

export async function clearOverridesAction(id: string) {
  updateGenerationOverrides(id, null);
  revalidatePath(`/ads/${id}`);
}

export async function replaceImageAction(id: string, fd: FormData) {
  const file = fd.get("file") as File | null;
  if (!file || !file.size) throw new Error("Pick an image");
  const gen = getGeneration(id);
  if (!gen) throw new Error("Generation missing");
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
  const current = parseOverrides(getGenerationOverrides(id));
  const merged: AdOverrides = { ...current, image: { ...current.image, replaceUrl: undefined, transparent: false } };
  updateGenerationOverrides(id, merged);
  revalidatePath(`/ads/${id}`);
}

export async function approveAd(id: string, note?: string) {
  updateGenerationStatus(id, "approved", note);
  revalidatePath(`/ads/${id}`);
  revalidatePath("/review");
}
export async function rejectAd(id: string, note?: string) {
  updateGenerationStatus(id, "rejected", note);
  revalidatePath(`/ads/${id}`);
  revalidatePath("/review");
}
export async function requestRevision(id: string, note?: string) {
  updateGenerationStatus(id, "needs_revision", note);
  revalidatePath(`/ads/${id}`);
  revalidatePath("/review");
}
export async function saveCopy(id: string, copy: { headline: string; subhead: string; cta: string; eyebrow: string }) {
  updateGenerationCopy(id, { headline: copy.headline, subhead: copy.subhead, cta: copy.cta, eyebrow: copy.eyebrow || undefined });
  revalidatePath(`/ads/${id}`);
}
