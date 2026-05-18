"use server";
import { createUser, getUserByEmail, pickAvatarColor, setCurrentUser } from "@/lib/users";
import { redirect } from "next/navigation";
import { isAllowlistEnforced, isEmailAllowed } from "@/lib/authz";

export async function signInAction(fd: FormData) {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const name = (String(fd.get("name") || "").trim() || email.split("@")[0]);
  if (!email) throw new Error("Email required");
  if (isAllowlistEnforced() && !isEmailAllowed(email)) {
    throw new Error("This email isn't on the allowlist. Ask the studio owner to add you.");
  }
  let user = getUserByEmail(email);
  if (!user) user = createUser(email, name, pickAvatarColor(email));
  if ((user as any).status === "disabled") {
    throw new Error("This account is disabled. Contact your studio admin.");
  }
  await setCurrentUser(user.id);
  redirect("/");
}

export async function signOutAction() {
  const { clearCurrentUser } = await import("@/lib/users");
  await clearCurrentUser();
  redirect("/signin");
}
