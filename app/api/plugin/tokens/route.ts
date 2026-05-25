import { NextRequest } from "next/server";
import { getBrandBySlug, hasBrandAccess, updateBrandTokens, getSavedTokenMapping, stageTokenMapping } from "@/lib/repo";
import { pluginUser, pluginJson, pluginPreflight, publicOrigin } from "@/lib/plugin";
import { proposeTokenMapping, applyMapping, type FigmaVar } from "@/lib/figma/token-map";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export function OPTIONS() { return pluginPreflight(); }

// POST /api/plugin/tokens  { brand, vars: [{name, value, type}] }
// The plugin sends ALL of the file's variables. If the brand already has a saved
// mapping, apply it directly; otherwise AI-propose a mapping, stage it, and tell
// the plugin to send the designer to Augen to review + confirm.
export async function POST(req: NextRequest) {
  const userId = pluginUser(req);
  if (!userId) return pluginJson({ error: "Unauthorized" }, 401);
  let body: any;
  try { body = await req.json(); } catch { return pluginJson({ error: "Bad JSON" }, 400); }

  const brand = getBrandBySlug(String(body?.brand || ""));
  if (!brand) return pluginJson({ error: "Brand not found" }, 404);
  if (!hasBrandAccess(userId, brand.id)) return pluginJson({ error: "No access to that brand." }, 403);

  const vars: FigmaVar[] = Array.isArray(body?.vars)
    ? body.vars
    : Object.entries(body?.vars || {}).map(([name, value]) => ({ name, value: value as any }));
  if (!vars.length) return pluginJson({ ok: false, error: "No variables found in this Figma file." });

  // Already mapped → apply directly (one-click re-pulls).
  const saved = getSavedTokenMapping(brand.id);
  if (saved) {
    const merged = applyMapping(brand.tokens, saved, vars);
    updateBrandTokens(brand.id, merged);
    revalidatePath(`/brands/${brand.slug}`);
    revalidatePath(`/brands/${brand.slug}/tokens`);
    const applied = Object.values(saved).filter((vn) => vn && vars.some((v) => v.name === vn)).length;
    return pluginJson({ ok: true, viaSaved: true, applied, message: `Applied your saved mapping (${applied} token${applied === 1 ? "" : "s"}).` });
  }

  // First time → propose + stage for review in Augen.
  const { mapping, viaAI } = await proposeTokenMapping(vars);
  stageTokenMapping(brand.id, { vars, mapping, viaAI });
  return pluginJson({
    ok: true,
    staged: true,
    proposed: Object.keys(mapping).length,
    viaAI,
    reviewUrl: `${publicOrigin(req)}/brands/${brand.slug}/figma`,
    message: `Read ${vars.length} variables. Review the proposed mapping in Augen, then it's one-click after that.`,
  });
}
