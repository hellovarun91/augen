import { NextRequest } from "next/server";
import { getBrand, getGeneration, getGenerationOverrides, getReference } from "@/lib/repo";
import { renderAdSvg } from "@/lib/composer/render";
import { brandLogo } from "@/lib/composer/logo";
import { rasterizeSvg } from "@/lib/composer/rasterize";
import { db } from "@/lib/db";
import { parseOverrides } from "@/lib/composer/overrides";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gen = getGeneration(id);
  if (!gen) return new Response("Not found", { status: 404 });
  const brand = getBrand(gen.brand_id);
  if (!brand) return new Response("Brand missing", { status: 404 });

  const refRow = db().prepare("SELECT reference_id FROM generations WHERE id = ?").get(id) as { reference_id: string | null } | undefined;
  const refObj = refRow?.reference_id ? getReference(refRow.reference_id) : null;
  const refUrl = refObj?.file_path
    ? new URL(refObj.file_path.startsWith("/") ? refObj.file_path : `/api/refs/${refObj.file_path.split("/").pop()}`, req.url).toString()
    : undefined;

  const overrides = parseOverrides(getGenerationOverrides(id));
  const effectiveRefUrl = overrides.image.replaceUrl
    ? (overrides.image.replaceUrl.startsWith("/") ? new URL(overrides.image.replaceUrl, req.url).toString() : new URL(`/api/refs/${overrides.image.replaceUrl}`, req.url).toString())
    : refUrl;
  const svg = renderAdSvg({
    width: gen.width, height: gen.height, aspect: gen.aspect,
    tokens: brand.tokens, copy: { eyebrow: gen.eyebrow || undefined, headline: gen.headline, subhead: gen.subhead || "", cta: gen.cta },
    seed: gen.image_seed, style: gen.image_style || brand.tokens.imagery.style,
    referenceUrl: effectiveRefUrl, overrides,
    logo: brandLogo(brand.id),
  });

  const png = await rasterizeSvg(svg, { width: Math.min(gen.width, 2048), inlineReferences: true });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${gen.id}.png"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
