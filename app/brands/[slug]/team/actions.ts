"use server";
import { getBrand } from "@/lib/repo";
import { getUserByEmail, createUser, addMembership, removeMembership, updateMembershipRole, getMembership } from "@/lib/users";
import { requireBrandAccess, addAllowedEmail } from "@/lib/authz";
import { ASSIGNABLE_ROLES } from "@/lib/roles";
import { revalidatePath } from "next/cache";

export async function inviteMemberAction(brandId: string, email: string, role: string) {
  const me = await requireBrandAccess(brandId);
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Enter a valid email address.");
  const r = ASSIGNABLE_ROLES.has(role) ? role : "copywriter";
  let u = getUserByEmail(e);
  if (!u) {
    const name = e.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    u = createUser(e, name);
  }
  addMembership(u.id, brandId, r);
  // Ensure the invitee can sign in even if the tester allowlist is enforced.
  addAllowedEmail(e, me.id, "team invite");
  const brand = getBrand(brandId);
  revalidatePath(`/brands/${brand?.slug}/team`);
}

export async function changeRoleAction(brandId: string, membershipId: string, role: string) {
  await requireBrandAccess(brandId);
  const m = getMembership(membershipId);
  if (!m || m.brand_id !== brandId) return;
  if (m.role === "owner") throw new Error("The brand owner's role can't be changed.");
  updateMembershipRole(membershipId, ASSIGNABLE_ROLES.has(role) ? role : m.role);
  const brand = getBrand(brandId);
  revalidatePath(`/brands/${brand?.slug}/team`);
}

export async function removeMemberAction(brandId: string, membershipId: string) {
  await requireBrandAccess(brandId);
  const m = getMembership(membershipId);
  if (!m || m.brand_id !== brandId) return;
  if (m.role === "owner") throw new Error("Can't remove the brand owner.");
  removeMembership(membershipId);
  const brand = getBrand(brandId);
  revalidatePath(`/brands/${brand?.slug}/team`);
}
