"use server";
import { updateGenerationStatus, updateGenerationCopy, setGenerationWinner } from "@/lib/repo";
import { revalidatePath } from "next/cache";

export async function toggleWinnerAction(id: string, on: boolean) {
  setGenerationWinner(id, on);
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
