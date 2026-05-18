import { NextRequest } from "next/server";
import { getBrand, getGeneration, getReference } from "@/lib/repo";
import { renderAdSvg } from "@/lib/composer/render";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = rawId.replace(/\.svg$/i, "");
  const url = new URL(req.url);
  const variantIdx = parseInt(url.searchParams.get("v") || "0", 10) || 0;
  const showLocker = url.searchParams.get("locker") !== "0";
  const showScrim = url.searchParams.get("scrim") !== "0";
  const bare = url.searchParams.get("bare") === "1";

  const gen = getGeneration(id);
  if (!gen) return new Response("Not found", { status: 404 });
  const brand = getBrand(gen.brand_id);
  if (!brand) return new Response("Brand missing", { status: 404 });

  const copy = gen.copy[Math.min(variantIdx, gen.copy.length - 1)] || {
    headline: gen.headline, subhead: gen.subhead || "", cta: gen.cta, eyebrow: gen.eyebrow || undefined,
  };

  const refRow = db().prepare("SELECT reference_id FROM generations WHERE id = ?").get(id) as { reference_id: string | null } | undefined;
  const refObj = refRow?.reference_id ? getReference(refRow.reference_id) : null;
  const referenceUrl = refObj?.file_path
    ? (refObj.file_path.startsWith("/") ? refObj.file_path : `/refs/${refObj.file_path.split("/").pop()}`)
    : undefined;

  const svg = renderAdSvg({
    width: gen.width,
    height: gen.height,
    aspect: gen.aspect,
    tokens: brand.tokens,
    copy,
    seed: gen.image_seed,
    style: gen.image_style || brand.tokens.imagery.style,
    showLocker,
    showScrim,
    bareBackground: bare,
    referenceUrl: referenceUrl ? new URL(referenceUrl, req.url).toString() : undefined,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
    },
  });
}
