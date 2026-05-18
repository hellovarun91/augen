"use server";
import { creditBilling } from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { requireBrandAccess } from "@/lib/authz";

export async function topUp(brandId: string) {
  await requireBrandAccess(brandId);
  creditBilling(brandId, 25000, "Manual top-up (mock)");
  revalidatePath("/billing");
}
