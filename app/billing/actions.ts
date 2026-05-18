"use server";
import { creditBilling } from "@/lib/repo";
import { revalidatePath } from "next/cache";

export async function topUp(brandId: string) {
  creditBilling(brandId, 25000, "Manual top-up (mock)");
  revalidatePath("/billing");
}
