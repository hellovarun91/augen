"use server";
import { logAdminAction, requireAdmin, setUserStatus } from "@/lib/admin";
import { setFeatureGlobalState, setUserOverride } from "@/lib/features";
import { changeTier, topUp, type Tier } from "@/lib/credits";
import { revalidatePath } from "next/cache";

export async function setStatusAction(userId: string, status: "active" | "disabled") {
  const admin = await requireAdmin();
  setUserStatus(userId, status);
  logAdminAction({ adminUserId: admin.id, action: "user.set_status", targetUserId: userId, payload: { status } });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
}

export async function setTierAction(userId: string, tier: Tier) {
  const admin = await requireAdmin();
  changeTier(userId, tier);
  logAdminAction({ adminUserId: admin.id, action: "user.set_tier", targetUserId: userId, payload: { tier } });
  revalidatePath(`/admin/users/${userId}`);
}

export async function grantCreditsAction(userId: string, amount: number, note?: string) {
  if (amount <= 0) throw new Error("Grant amount must be positive");
  const admin = await requireAdmin();
  topUp(userId, amount, note || "Admin grant");
  logAdminAction({ adminUserId: admin.id, action: "user.grant_credits", targetUserId: userId, payload: { amount, note } });
  revalidatePath(`/admin/users/${userId}`);
}

export async function setFlagGlobalAction(name: string, enabled: boolean) {
  const admin = await requireAdmin();
  setFeatureGlobalState(name, enabled);
  logAdminAction({ adminUserId: admin.id, action: "flag.set_global", payload: { name, enabled } });
  revalidatePath("/admin/features");
  revalidatePath("/admin");
}

export async function setFlagOverrideAction(name: string, userId: string, enabled: boolean | null) {
  const admin = await requireAdmin();
  setUserOverride(name, userId, enabled);
  logAdminAction({
    adminUserId: admin.id, action: "flag.set_user_override",
    targetUserId: userId, payload: { name, enabled },
  });
  revalidatePath(`/admin/users/${userId}`);
}
