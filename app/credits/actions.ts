"use server";
import { changeTier, topUp, type Tier } from "@/lib/credits";
import { requireUser } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function topUpAction(amount: number) {
  const u = await requireUser();
  topUp(u.id, amount, "Mock top-up");
  revalidatePath("/credits");
}

export async function changeTierAction(tier: Tier) {
  const u = await requireUser();
  changeTier(u.id, tier);
  revalidatePath("/credits");
}
