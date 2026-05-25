"use server";
import { createApiToken, revokeApiToken } from "@/lib/repo";
import { requireUser } from "@/lib/authz";
import { revalidatePath } from "next/cache";

// Returns the plaintext token ONCE — it is never retrievable again.
export async function createTokenAction(name: string): Promise<{ token: string; id: string; name: string }> {
  const user = await requireUser();
  const { token, row } = createApiToken(user.id, name?.trim() || "Claude");
  revalidatePath("/settings/mcp");
  return { token, id: row.id, name: row.name };
}

export async function revokeTokenAction(id: string) {
  const user = await requireUser();
  revokeApiToken(id, user.id);
  revalidatePath("/settings/mcp");
}
