import { NextRequest } from "next/server";
import { getBrandBySlug, listCampaignsByBrand, listGenerationsByCampaign } from "@/lib/repo";
import { formatBySlug } from "@/lib/formats";
import { pluginAuthorized, pluginConfigured, pluginJson, pluginPreflight } from "@/lib/plugin";

export const dynamic = "force-dynamic";

export function OPTIONS() { return pluginPreflight(); }

// GET /api/plugin/creatives?brand=<slug>&token=<t>
// Lists a brand's creatives for the Figma plugin: copy + a render URL per ad.
export async function GET(req: NextRequest) {
  if (!pluginConfigured()) return pluginJson({ error: "Plugin API not configured (set PLUGIN_API_TOKEN)." }, 503);
  if (!pluginAuthorized(req)) return pluginJson({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const slug = url.searchParams.get("brand") || "";
  const brand = getBrandBySlug(slug);
  if (!brand) return pluginJson({ error: "Brand not found" }, 404);

  const origin = `${url.protocol}//${url.host}`;
  const creatives = listCampaignsByBrand(brand.id)
    .flatMap((c) => listGenerationsByCampaign(c.id))
    .map((g) => {
      const f = formatBySlug(g.format_slug);
      return {
        id: g.id,
        format: f?.name || g.format_slug,
        width: g.width,
        height: g.height,
        status: g.status,
        headline: g.headline || "",
        subhead: g.subhead || "",
        cta: g.cta || "",
        eyebrow: g.eyebrow || "",
        pngUrl: `${origin}/api/render/${g.id}/png`,
      };
    });

  return pluginJson({ brand: { slug: brand.slug, name: brand.name }, creatives });
}
