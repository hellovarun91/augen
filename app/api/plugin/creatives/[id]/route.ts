import { NextRequest } from "next/server";
import { getGeneration, updateGenerationCopy } from "@/lib/repo";
import { pluginAuthorized, pluginConfigured, pluginJson, pluginPreflight } from "@/lib/plugin";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export function OPTIONS() { return pluginPreflight(); }

// POST /api/plugin/creatives/[id]  { headline, subhead, cta, eyebrow }
// Writes copy edited in Figma back onto the creative, then returns a fresh render URL.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!pluginConfigured()) return pluginJson({ error: "Plugin API not configured." }, 503);
  if (!pluginAuthorized(req)) return pluginJson({ error: "Unauthorized" }, 401);

  const { id } = await params;
  const gen = getGeneration(id);
  if (!gen) return pluginJson({ error: "Creative not found" }, 404);

  let body: any;
  try { body = await req.json(); } catch { return pluginJson({ error: "Bad JSON" }, 400); }

  updateGenerationCopy(id, {
    headline: typeof body.headline === "string" ? body.headline : gen.headline,
    subhead: typeof body.subhead === "string" ? body.subhead : (gen.subhead || ""),
    cta: typeof body.cta === "string" ? body.cta : gen.cta,
    eyebrow: typeof body.eyebrow === "string" ? body.eyebrow : (gen.eyebrow || undefined),
  });
  revalidatePath(`/ads/${id}`);

  const origin = `${new URL(req.url).protocol}//${new URL(req.url).host}`;
  return pluginJson({ ok: true, id, pngUrl: `${origin}/api/render/${id}/png?t=${Date.now()}` });
}
