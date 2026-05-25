"use server";
import { requireUser } from "@/lib/authz";
import { createApiToken, getDeviceCode, approveDeviceCode } from "@/lib/repo";

// Approves a pending device code from inside the user's authenticated session:
// mints a personal token (named "Figma plugin") and binds it to the code so the
// plugin can claim it on its next poll.
export async function approveConnectAction(code: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const row = getDeviceCode(code);
  if (!row) return { ok: false, error: "This link is invalid or already used." };
  if (row.status !== "pending") return { ok: false, error: "This link was already used." };
  if (row.expires_at < Date.now()) return { ok: false, error: "This link expired — start again in Figma." };
  const { token } = createApiToken(user.id, "Figma plugin");
  const ok = approveDeviceCode(code, user.id, token);
  return ok ? { ok: true } : { ok: false, error: "Could not approve — start again in Figma." };
}
