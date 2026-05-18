"use server";
import { createUser, getUserByEmail, pickAvatarColor, setCurrentUser } from "@/lib/users";
import { redirect } from "next/navigation";

export async function signInAction(fd: FormData) {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const name = (String(fd.get("name") || "").trim() || email.split("@")[0]);
  if (!email) throw new Error("Email required");
  let user = getUserByEmail(email);
  if (!user) user = createUser(email, name, pickAvatarColor(email));
  await setCurrentUser(user.id);
  redirect("/");
}

export async function signOutAction() {
  const { clearCurrentUser } = await import("@/lib/users");
  await clearCurrentUser();
  redirect("/signin");
}
