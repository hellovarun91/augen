import { NextRequest } from "next/server";
import { getBrand } from "@/lib/repo";
import { renderAdSvg } from "@/lib/composer/render";
import { brandLogo } from "@/lib/composer/logo";
import { formatBySlug } from "@/lib/formats";
import { hashStr } from "@/lib/ai/rand";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand")!;
  const fmt = formatBySlug(url.searchParams.get("fmt") || "meta-feed-1x1");
  if (!fmt) return new Response("Unknown format", { status: 400 });
  const brand = getBrand(brandId);
  if (!brand) return new Response("Brand missing", { status: 404 });

  const copy = {
    eyebrow: url.searchParams.get("eye") || undefined,
    headline: url.searchParams.get("head") || "Untitled\nheadline",
    subhead: url.searchParams.get("sub") || "",
    cta: url.searchParams.get("cta") || "Learn more",
  };
  const seed = hashStr(`${brand.slug}|${fmt.slug}|${copy.headline}`);
  const svg = renderAdSvg({
    width: fmt.width, height: fmt.height, aspect: fmt.aspect,
    tokens: brand.tokens, copy, seed,
    style: brand.tokens.imagery.style,
    logo: brandLogo(brand.id),
  });
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
