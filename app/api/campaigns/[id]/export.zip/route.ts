import { NextRequest } from "next/server";
import JSZip from "jszip";
import { getBrand, getCampaign, getGenerationOverrides, getReference, listGenerationsByCampaign } from "@/lib/repo";
import { renderAdSvg } from "@/lib/composer/render";
import { brandLogo, resolvePlacedAssets } from "@/lib/composer/logo";
import { rasterizeSvg, inlineRefImages } from "@/lib/composer/rasterize";
import { formatBySlug } from "@/lib/formats";
import { db } from "@/lib/db";
import { parseOverrides } from "@/lib/composer/overrides";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCampaign(id);
  if (!c) return new Response("Not found", { status: 404 });
  const b = getBrand(c.brand_id);
  if (!b) return new Response("Brand missing", { status: 404 });

  const onlyApproved = new URL(req.url).searchParams.get("approved") !== "0";
  const gens = listGenerationsByCampaign(c.id).filter((g) => !onlyApproved || g.status === "approved");

  const zip = new JSZip();
  const root = zip.folder(`${b.slug}-${c.id}`)!;

  // Brief and manifest
  root.file("brief.json", JSON.stringify({
    campaign: c.name,
    quarter: c.quarter,
    year: c.year,
    objective: c.objective,
    audience: c.audience,
    brief: c.brief,
    brand: { id: b.id, slug: b.slug, name: b.name, tokens: b.tokens, language: b.language },
    exported_at: new Date().toISOString(),
    counts: { total: gens.length, approved: gens.filter((g) => g.status === "approved").length },
  }, null, 2));

  const includePng = new URL(req.url).searchParams.get("png") !== "0";

  const manifest = gens.map((g) => {
    const fmt = formatBySlug(g.format_slug);
    return {
      id: g.id,
      format: g.format_slug,
      width: g.width, height: g.height,
      headline: g.headline, subhead: g.subhead, cta: g.cta, eyebrow: g.eyebrow,
      confidence: g.confidence,
      status: g.status,
      svg: `${g.format_slug}/${g.id}.svg`,
      png: includePng ? `${g.format_slug}/${g.id}.png` : undefined,
      platform: fmt?.platform,
      placement: fmt?.placement,
    };
  });
  root.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Per-format folders with SVG (refs inlined as base64) and rasterized PNG
  for (const g of gens) {
    const fmtFolder = root.folder(g.format_slug)!;
    const refRow = db().prepare("SELECT reference_id FROM generations WHERE id = ?").get(g.id) as { reference_id: string | null } | undefined;
    const refObj = refRow?.reference_id ? getReference(refRow.reference_id) : null;
    const refUrl = refObj?.file_path
      ? (refObj.file_path.startsWith("/") ? refObj.file_path : `/api/refs/${refObj.file_path.split("/").pop()}`)
      : undefined;
    const overrides = parseOverrides(getGenerationOverrides(g.id));
    const effectiveRefUrl = overrides.image.replaceUrl
      ? (overrides.image.replaceUrl.startsWith("/") ? overrides.image.replaceUrl : `/api/refs/${overrides.image.replaceUrl}`)
      : refUrl;
    const rawSvg = renderAdSvg({
      width: g.width, height: g.height, aspect: g.aspect, tokens: b.tokens,
      copy: { eyebrow: g.eyebrow || undefined, headline: g.headline, subhead: g.subhead || "", cta: g.cta },
      seed: g.image_seed, style: g.image_style || b.tokens.imagery.style,
      referenceUrl: effectiveRefUrl,
      overrides,
      logo: brandLogo(b.id),
      placedAssets: resolvePlacedAssets(overrides.placedAssets),
    });
    const standaloneSvg = await inlineRefImages(rawSvg);
    fmtFolder.file(`${g.id}.svg`, standaloneSvg);
    if (includePng) {
      try {
        const png = await rasterizeSvg(rawSvg, { width: Math.min(g.width, 2048), inlineReferences: true });
        fmtFolder.file(`${g.id}.png`, png);
      } catch (e: any) {
        console.warn(`[export] PNG failed for ${g.id}:`, e?.message || e);
      }
    }
  }

  const README = `# ${b.name} — ${c.name}

Exported ${new Date().toISOString()}

Contents:
- manifest.json — every ad's metadata, status, and confidence
- brief.json — campaign brief + brand tokens + brand language
- one folder per ad format with SVG files at the platform's native dimensions

Notes:
- SVGs reference photos by absolute URL when a brand reference was used.
  When you ship these files, replace the URL with an embedded base64 or
  rasterize to PNG with your renderer of choice.
- Approved ads only by default. Add ?approved=0 to the export URL to include all.
`;
  root.file("README.md", README);

  const ab = await zip.generateAsync({ type: "arraybuffer" });
  return new Response(ab, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${b.slug}-${c.id}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
