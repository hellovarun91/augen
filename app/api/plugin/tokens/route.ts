import { NextRequest } from "next/server";
import { getBrandBySlug, hasBrandAccess, updateBrandTokens } from "@/lib/repo";
import { pluginUser, pluginJson, pluginPreflight } from "@/lib/plugin";
import { partialTokensFromVars, mergeTokens } from "@/lib/figma/sync";
import { BrandTokens } from "@/lib/types";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export function OPTIONS() { return pluginPreflight(); }

// POST /api/plugin/tokens  { brand, vars: { "color/background": "#...", "font/display": "Inter", ... } }
// The plugin reads the file's Variables (any plan) and posts them here; we map
// them onto the brand's design tokens via the naming convention and merge.
export async function POST(req: NextRequest) {
  const userId = pluginUser(req);
  if (!userId) return pluginJson({ error: "Unauthorized" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return pluginJson({ error: "Bad JSON" }, 400); }

  const brand = getBrandBySlug(String(body?.brand || ""));
  if (!brand) return pluginJson({ error: "Brand not found" }, 404);
  if (!hasBrandAccess(userId, brand.id)) return pluginJson({ error: "No access to that brand." }, 403);

  const partial = partialTokensFromVars(body?.vars || {});
  const groups = Object.keys(partial);
  if (!groups.length) {
    return pluginJson({ ok: true, changed: 0, message: "No mappable variables found. Name them color/background, font/display, type/headlineSize, scrim/bottomOpacity, etc." });
  }
  const merged = BrandTokens.parse(mergeTokens(brand.tokens, partial));
  updateBrandTokens(brand.id, merged);
  revalidatePath(`/brands/${brand.slug}`);
  revalidatePath(`/brands/${brand.slug}/tokens`);
  return pluginJson({ ok: true, changed: groups.length, groups });
}
