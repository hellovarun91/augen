import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs/promises";
import path from "node:path";

export interface RasterizeOptions {
  width?: number;
  /** Reference URL inliner — for SVGs that have <image href="/refs/..."> we'd otherwise lose the photo
   *  in standalone exports. When true, inline as base64. */
  inlineReferences?: boolean;
}

export async function rasterizeSvg(svg: string, opts: RasterizeOptions = {}): Promise<Buffer> {
  const prepared = opts.inlineReferences ? await inlineRefImages(svg) : svg;
  const resvg = new Resvg(prepared, {
    fitTo: opts.width ? { mode: "width", value: opts.width } : { mode: "original" },
    font: { loadSystemFonts: true },
    background: "white",
  });
  const png = resvg.render().asPng();
  return Buffer.from(png);
}

// Inlines /refs/{name} image hrefs as base64 data URIs so SVGs can travel standalone.
export async function inlineRefImages(svg: string): Promise<string> {
  const refsDir = path.join(process.cwd(), "public", "refs");
  // Match href or xlink:href that points to /refs/... OR an absolute URL containing /refs/
  const pattern = /(href|xlink:href)\s*=\s*"([^"]+?)"/g;
  const replacements: Array<{ match: string; replacement: string }> = [];
  for (const m of svg.matchAll(pattern)) {
    const url = m[2];
    let fileName: string | null = null;
    const refIdx = url.indexOf("/refs/");
    if (refIdx >= 0) fileName = url.slice(refIdx + "/refs/".length).split("?")[0].split("#")[0];
    if (!fileName) continue;
    try {
      const abs = path.join(refsDir, fileName);
      const buf = await fs.readFile(abs);
      const mime = fileName.endsWith(".png") ? "image/png"
        : fileName.endsWith(".webp") ? "image/webp"
        : fileName.endsWith(".gif") ? "image/gif"
        : "image/jpeg";
      const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
      replacements.push({ match: m[0], replacement: `${m[1]}="${dataUri}"` });
    } catch {
      // file missing — keep original href
    }
  }
  let out = svg;
  for (const r of replacements) out = out.replace(r.match, r.replacement);
  return out;
}
