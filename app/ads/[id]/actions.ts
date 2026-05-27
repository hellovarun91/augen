"use server";
import {
  updateGenerationStatus, updateGenerationCopy, setGenerationWinner,
  getBrand, getGenerationOverrides, updateGenerationOverrides, recordVisionReview,
  onDesignCopyEdited, applyCopyToRowSiblings,
} from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { AdOverrides, mergeOverrides, parseOverrides } from "@/lib/composer/overrides";
import { saveUploadedImage } from "@/lib/images/providers";
import { requireGenerationAccess } from "@/lib/authz";
import { runVisionCritic, type VisionCritique } from "@/lib/agents/vision-critic";

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
  const { user } = await requireGenerationAccess(id);
  updateGenerationStatus(id, "approved", note, user.id);
  revalidatePath(`/ads/${id}`);
  revalidatePath("/review");
}
export async function rejectAd(id: string, note?: string) {
  const { user } = await requireGenerationAccess(id);
  updateGenerationStatus(id, "rejected", note, user.id);
  revalidatePath(`/ads/${id}`);
  revalidatePath("/review");
}
export async function requestRevision(id: string, note?: string) {
  const { user } = await requireGenerationAccess(id);
  updateGenerationStatus(id, "needs_revision", note, user.id);
  revalidatePath(`/ads/${id}`);
  revalidatePath("/review");
}
// Vision QC: render the current composite to PNG (via the render route, so it
// reflects edits/overrides), let the vision critic inspect the pixels, and store
// the design score + a vision-critic review. Returns the critique for the UI.
export async function runVisualQcAction(id: string): Promise<VisionCritique> {
  const { generation: gen } = await requireGenerationAccess(id);
  const brand = getBrand(gen.brand_id);
  if (!brand) throw new Error("Brand missing");

  let png: { bytes: Buffer; mime: string } | undefined;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
    if (host) {
      const res = await fetch(`${proto}://${host}/api/render/${id}/png`, { cache: "no-store" });
      if (res.ok) png = { bytes: Buffer.from(await res.arrayBuffer()), mime: "image/png" };
    }
  } catch { /* fall through to heuristic */ }

  const { output } = await runVisionCritic({
    brand, language: brand.language, formatSlug: gen.format_slug,
    copy: { eyebrow: gen.eyebrow || undefined, headline: gen.headline, subhead: gen.subhead || "", cta: gen.cta },
    png,
  });
  recordVisionReview(id, { score: output.overallScore, verdict: output.verdict, notes: output.notes, fixes: output.fixes });
  revalidatePath(`/ads/${id}`);
  revalidatePath("/review");
  return output;
}

// Edit a design's copy. The row is the source of truth, so this flows back to it;
// the design is no longer stale but its look needs a re-look, and its siblings (the
// row's other sizes) go stale. Returns how many siblings can be brought in line.
export async function saveCopy(id: string, copy: { headline: string; subhead: string; cta: string; eyebrow: string }) {
  const { generation } = await requireGenerationAccess(id);
  updateGenerationCopy(id, { headline: copy.headline, subhead: copy.subhead, cta: copy.cta, eyebrow: copy.eyebrow || undefined });
  const { rowId, siblingCount } = onDesignCopyEdited(id);
  revalidatePath(`/ads/${id}`);
  if (generation.campaign_id) revalidatePath(`/campaigns/${generation.campaign_id}/copy`);
  revalidatePath("/review");
  return { rowId, siblingCount };
}

// Push this design's copy onto the row's other sizes (so they match), then they
// need a re-look. Returns the number of siblings updated.
export async function applyCopyToSiblingsAction(id: string) {
  const { generation } = await requireGenerationAccess(id);
  const count = applyCopyToRowSiblings(id);
  revalidatePath(`/ads/${id}`);
  if (generation.campaign_id) revalidatePath(`/campaigns/${generation.campaign_id}/copy`);
  revalidatePath("/review");
  return count;
}
