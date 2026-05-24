import fs from "node:fs";
import path from "node:path";
import { refsDir } from "@/lib/db";
import { getAsset, getLockerLogo, type BrandAsset } from "@/lib/repo";

// Read a stored asset and inline it as a base64 data-URI so the composer can
// embed it directly (works in the browser and survives resvg PNG export).
function dataUri(asset: BrandAsset | null): string | null {
  if (!asset) return null;
  try {
    const fileName = asset.file_path.replace(/^.*\/refs\//, "").split("?")[0].split("#")[0];
    const buf = fs.readFileSync(path.join(refsDir(), fileName));
    const mime = asset.mime
      || (fileName.endsWith(".svg") ? "image/svg+xml" : fileName.endsWith(".png") ? "image/png" : "image/jpeg");
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// The brand's locker logo for the composer: primary + optional inverse variant.
export function brandLogo(brandId: string): { href: string; inverseHref?: string } | undefined {
  const primary = getLockerLogo(brandId, "primary");
  const href = dataUri(primary);
  if (!href || !primary) return undefined;
  const inverse = getLockerLogo(brandId, "inverse");
  const inverseHref = inverse && inverse.id !== primary.id ? dataUri(inverse) : null;
  return { href, inverseHref: inverseHref || undefined };
}

// Resolve per-ad placed assets (assetId + position) into renderable data-URIs.
export function resolvePlacedAssets(
  items: Array<{ assetId: string; x: number; y: number; scale: number }>,
): Array<{ href: string; x: number; y: number; scale: number }> {
  const out: Array<{ href: string; x: number; y: number; scale: number }> = [];
  for (const it of items || []) {
    const href = dataUri(getAsset(it.assetId));
    if (href) out.push({ href, x: it.x, y: it.y, scale: it.scale });
  }
  return out;
}
