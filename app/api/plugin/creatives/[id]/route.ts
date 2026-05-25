import { NextRequest } from "next/server";
import { getGeneration, updateGenerationCopy, getGenerationOverrides, updateGenerationOverrides, hasBrandAccess } from "@/lib/repo";
import { pluginUser, pluginJson, pluginPreflight } from "@/lib/plugin";
import { parseOverrides, mergeOverrides } from "@/lib/composer/overrides";
import { revalidatePath } from "next/cache";

const CTA_POSITIONS = ["auto", "top-right", "bottom-right", "bottom-left", "inline-right"];

export const dynamic = "force-dynamic";

export function OPTIONS() { return pluginPreflight(); }

// POST /api/plugin/creatives/[id]  { headline, subhead, cta, eyebrow, layout? }
// Writes copy + layout edited in Figma back onto the creative; returns a fresh render URL.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = pluginUser(req);
  if (!userId) return pluginJson({ error: "Unauthorized — generate a token in Augen → Settings → MCP & API." }, 401);

  const { id } = await params;
  const gen = getGeneration(id);
  if (!gen) return pluginJson({ error: "Creative not found" }, 404);
  if (!hasBrandAccess(userId, gen.brand_id)) return pluginJson({ error: "You don't have access to that creative." }, 403);

  let body: any;
  try { body = await req.json(); } catch { return pluginJson({ error: "Bad JSON" }, 400); }

  updateGenerationCopy(id, {
    headline: typeof body.headline === "string" ? body.headline : gen.headline,
    subhead: typeof body.subhead === "string" ? body.subhead : (gen.subhead || ""),
    cta: typeof body.cta === "string" ? body.cta : gen.cta,
    eyebrow: typeof body.eyebrow === "string" ? body.eyebrow : (gen.eyebrow || undefined),
  });

  // Optional layout round-trip: positions moved in Figma → Augen overrides.
  const L = body.layout;
  if (L && typeof L === "object") {
    const patch: any = { layout: {} };
    if (typeof L.headlineYShift === "number") patch.layout.headlineYShift = Math.max(-0.3, Math.min(0.3, L.headlineYShift));
    if (typeof L.ctaPosition === "string" && CTA_POSITIONS.includes(L.ctaPosition)) patch.layout.ctaPosition = L.ctaPosition;
    if (Object.keys(patch.layout).length) {
      const merged = mergeOverrides(parseOverrides(getGenerationOverrides(id)), patch);
      updateGenerationOverrides(id, merged);
    }
  }
  revalidatePath(`/ads/${id}`);

  const origin = `${new URL(req.url).protocol}//${new URL(req.url).host}`;
  return pluginJson({ ok: true, id, pngUrl: `${origin}/api/render/${id}/png?t=${Date.now()}` });
}
