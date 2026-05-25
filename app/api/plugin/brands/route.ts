import { NextRequest } from "next/server";
import { listBrandsForUser } from "@/lib/repo";
import { pluginUser, pluginJson, pluginPreflight } from "@/lib/plugin";

export const dynamic = "force-dynamic";
export function OPTIONS() { return pluginPreflight(); }

// Lists the connected user's brands for the plugin's brand picker.
export async function GET(req: NextRequest) {
  const userId = pluginUser(req);
  if (!userId) return pluginJson({ error: "Unauthorized" }, 401);
  const brands = listBrandsForUser(userId).map((b) => ({ slug: b.slug, name: b.name, industry: b.industry || "" }));
  return pluginJson({ brands });
}
