import type { BrandTokens } from "@/lib/types";
import { buildBackground } from "./background";
import { resolveLayout } from "./layout";
import type { AdOverrides } from "./overrides";

export interface RenderArgs {
  width: number;
  height: number;
  aspect: string;
  tokens: BrandTokens;
  copy: {
    eyebrow?: string;
    headline: string;
    subhead?: string;
    cta: string;
  };
  seed: number;
  style: string;
  showLocker?: boolean;
  showScrim?: boolean;
  bareBackground?: boolean;
  referenceUrl?: string; // public path like /refs/foo.jpg, embeds into the SVG
  overrides?: AdOverrides;
  // Primary brand logo (data-URI) for the locker; inverseHref is the light/
  // knockout variant used on dark backgrounds. Falls back to the text wordmark.
  logo?: { href: string; inverseHref?: string };
}

export function renderAdSvg(args: RenderArgs): string {
  const { width, height, aspect, tokens, copy, seed, style } = args;
  const ov = args.overrides;
  const layout = resolveLayout(width, height, aspect, tokens, ov);
  const palette = [
    tokens.palette.background,
    tokens.palette.surface,
    tokens.palette.foreground,
    tokens.palette.primary,
    tokens.palette.secondary,
    tokens.palette.accent,
    tokens.palette.muted,
  ];

  // Resolve image source: manual replace > reference URL > generated SVG bg
  const finalRefUrl = ov?.image?.replaceUrl || args.referenceUrl;
  const bg = finalRefUrl
    ? buildPhotoBackground(finalRefUrl, width, height, ov, tokens)
    : args.bareBackground
      ? `<rect width="${width}" height="${height}" fill="${tokens.palette.background}"/>`
      : buildBackground({ width, height, seed, palette, style });

  // Scrim — overrides applied at layout time (coverage) plus runtime opacity
  const scrimOp = ov?.layout?.scrimOpacity ?? tokens.scrim.bottomOpacity;
  const scrim = args.showScrim !== false ? buildScrim(width, layout.scrim.yStart, layout.scrim.height, tokens, scrimOp) : "";

  const onLight = isLightOver(tokens.palette.background, scrimOp);
  const defaultFg = onLight ? darkest(tokens) : lightest(tokens);
  const accentColor = tokens.palette.accent;

  const colors = {
    eyebrow: ov?.colors?.eyebrow || defaultFg,
    headline: ov?.colors?.headline || defaultFg,
    subhead: ov?.colors?.subhead || defaultFg,
    cta: ov?.colors?.cta || defaultFg,
    rule: ov?.colors?.rule || accentColor,
    accent: ov?.colors?.headline ? accentColor : accentColor,
  };

  const lockerVisible = (ov?.layout?.lockerVisible !== false) && args.showLocker !== false;
  // On dark backgrounds prefer the inverse (light) logo; else the primary.
  const lockerLogo = args.logo ? (onLight ? args.logo.href : (args.logo.inverseHref || args.logo.href)) : null;
  const text = buildText(layout, tokens, copy, colors, ov, lockerVisible, lockerLogo);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">
${bg}
${scrim}
${text}
</svg>`;
}

function buildPhotoBackground(refUrl: string, width: number, height: number, ov: AdOverrides | undefined, tokens: BrandTokens): string {
  const crop = ov?.image?.crop || { panX: 0, panY: 0, scale: 1 };
  const scale = Math.max(0.5, Math.min(3, crop.scale ?? 1));
  // Apply scale and pan via transform around the center.
  // We render the image at width*scale × height*scale, then translate to pan and recenter.
  const w2 = Math.round(width * scale);
  const h2 = Math.round(height * scale);
  const tx = Math.round(((width - w2) / 2) + crop.panX * width);
  const ty = Math.round(((height - h2) / 2) + crop.panY * height);
  const filter = ov?.image?.filter || "none";
  const filterDef = filter !== "none" ? buildImageFilter(filter) : "";
  const filterAttr = filter !== "none" ? ` filter="url(#imgfilt)"` : "";

  // Transparent uploads (subject only): show brand background underneath, place image centered.
  if (ov?.image?.transparent) {
    return `${filterDef}
<rect x="0" y="0" width="${width}" height="${height}" fill="${tokens.palette.background}"/>
<image href="${escapeXml(refUrl)}" x="${tx}" y="${ty}" width="${w2}" height="${h2}" preserveAspectRatio="xMidYMid meet"${filterAttr}/>`;
  }

  return `${filterDef}
<image href="${escapeXml(refUrl)}" x="${tx}" y="${ty}" width="${w2}" height="${h2}" preserveAspectRatio="xMidYMid slice"${filterAttr}/>`;
}

function buildImageFilter(filter: string): string {
  // SVG filter matrices for common photo treatments
  const matrices: Record<string, string> = {
    grayscale: "0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0",
    warm:      "1.05 0.05 0    0 0  0    1.0  0    0 0  0    0    0.92 0 0  0 0 0 1 0",
    cool:      "0.92 0    0.05 0 0  0    1.0  0    0 0  0.05 0    1.08 0 0  0 0 0 1 0",
    dark:      "0.75 0 0 0 0  0 0.75 0 0 0  0 0 0.75 0 0  0 0 0 1 0",
    light:     "1.15 0 0 0 0  0 1.15 0 0 0  0 0 1.15 0 0  0 0 0 1 0",
  };
  const m = matrices[filter];
  if (!m) return "";
  return `<defs><filter id="imgfilt"><feColorMatrix type="matrix" values="${m}"/></filter></defs>`;
}

function buildScrim(width: number, yStart: number, h: number, tokens: BrandTokens, bottomOpacity: number): string {
  const tint = tokens.scrim.tint || "#000000";
  const id = "scrim_grad";
  return `<defs>
  <linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0%" stop-color="${tint}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${tint}" stop-opacity="${bottomOpacity}"/>
  </linearGradient>
</defs>
<rect x="0" y="${yStart}" width="${width}" height="${h}" fill="url(#${id})"/>`;
}

function buildText(
  layout: ReturnType<typeof resolveLayout>,
  tokens: BrandTokens,
  copy: { eyebrow?: string; headline: string; subhead?: string; cta: string },
  colors: { eyebrow: string; headline: string; subhead: string; cta: string; rule: string; accent: string },
  ov: AdOverrides | undefined,
  showLocker: boolean,
  lockerLogo: string | null,
): string {
  const displayFamily = escapeAttr(tokens.fonts.display);
  const bodyFamily = escapeAttr(tokens.fonts.body);
  const headlineSize = layout.headline.size;
  const lines = wrapToLines(copy.headline, layout.headline.maxWidth, headlineSize, /heavy|bold/i.test(displayFamily));
  const headlineY = layout.headline.y;
  const weightMap: Record<string, number> = { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 };
  const headlineWeight = weightMap[ov?.typography?.headlineWeight || "medium"] || 500;
  const emphasis = ov?.typography?.emphasis || [];

  const headlineTspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : headlineSize * layout.headline.lineHeight;
      const inner = renderHeadlineLine(line, emphasis, colors.accent);
      return `<tspan x="${layout.headline.x}" dy="${dy}">${inner}</tspan>`;
    })
    .join("");

  const eyebrow = copy.eyebrow
    ? `<text x="${layout.eyebrow.x}" y="${layout.eyebrow.y}" font-family='${bodyFamily}' font-size="${layout.eyebrow.size}" font-weight="600" letter-spacing="${(layout.eyebrow.tracking * layout.eyebrow.size).toFixed(2)}" fill="${colors.eyebrow}">${escapeXml(copy.eyebrow)}</text>`
    : "";

  const rule = `<rect x="${layout.rule.x}" y="${layout.rule.y}" width="${layout.rule.w}" height="${layout.rule.h}" fill="${colors.rule}"/>`;

  const headline = `<text x="${layout.headline.x}" y="${headlineY}" font-family='${displayFamily}' font-size="${headlineSize}" font-weight="${headlineWeight}" letter-spacing="${(layout.headline.tracking * headlineSize).toFixed(2)}" fill="${colors.headline}">${headlineTspans}</text>`;

  const subhead = copy.subhead
    ? `<text x="${layout.subhead.x}" y="${layout.subhead.y}" font-family='${bodyFamily}' font-size="${layout.subhead.size}" font-weight="400" fill="${colors.subhead}">${wrapSubhead(copy.subhead, layout.subhead.maxWidth, layout.subhead.size, layout.subhead.x)}</text>`
    : "";

  const ctaAnchor = layout.cta.x > layout.width / 2 + 20 ? "end" : "start";
  const cta = `<text x="${layout.cta.x}" y="${layout.cta.y}" font-family='${bodyFamily}' font-size="${layout.cta.size}" font-weight="600" text-anchor="${ctaAnchor}" fill="${colors.cta}">${escapeXml(copy.cta)} →</text>`;

  let locker = "";
  if (showLocker) {
    if (lockerLogo) {
      // Logo composited into the locker. preserveAspectRatio fits it within a
      // bounding box (no need to know the file's intrinsic dimensions),
      // bottom-aligned to the wordmark baseline and aligned to the locker edge.
      const boxH = Math.round(layout.locker.size * 1.7);
      const boxW = Math.min(Math.round(layout.width * 0.5), boxH * 7);
      const right = layout.locker.align === "right";
      const lx = right ? layout.locker.x - boxW : layout.locker.x;
      const ly = layout.locker.y - boxH;
      const par = right ? "xMaxYMax meet" : "xMinYMax meet";
      locker = `<image x="${lx}" y="${ly}" width="${boxW}" height="${boxH}" preserveAspectRatio="${par}" href="${lockerLogo}"/>`;
    } else {
      locker = `<text x="${layout.locker.x}" y="${layout.locker.y}" font-family='${bodyFamily}' font-size="${layout.locker.size}" font-weight="700" letter-spacing="${(0.16 * layout.locker.size).toFixed(2)}" fill="${colors.headline}">${escapeXml(tokens.locker.wordmark)}</text>`;
    }
  }

  return [eyebrow, rule, headline, subhead, cta, locker].join("\n");
}

// Wraps any matching emphasized word in tspans with the appropriate style.
function renderHeadlineLine(line: string, emphasis: Array<{ word: string; style: string }>, accent: string): string {
  if (!emphasis.length) return escapeXml(line);
  // Build a single regex matching any emphasized word (case-insensitive, word boundary)
  const words = emphasis.filter((e) => e.word.trim().length > 0);
  if (!words.length) return escapeXml(line);
  const pattern = new RegExp("\\b(" + words.map((w) => escapeRegex(w.word)).join("|") + ")\\b", "i");
  const out: string[] = [];
  let rest = line;
  let safety = 0;
  while (rest && safety++ < 40) {
    const m = rest.match(pattern);
    if (!m || m.index == null) { out.push(escapeXml(rest)); break; }
    if (m.index > 0) out.push(escapeXml(rest.slice(0, m.index)));
    const matched = m[0];
    const ent = words.find((w) => w.word.toLowerCase() === matched.toLowerCase());
    out.push(emphasisTspan(matched, ent?.style || "accent", accent));
    rest = rest.slice(m.index + matched.length);
  }
  return out.join("");
}

function emphasisTspan(text: string, style: string, accent: string): string {
  const safe = escapeXml(text);
  switch (style) {
    case "italic": return `<tspan font-style="italic">${safe}</tspan>`;
    case "underline": return `<tspan text-decoration="underline">${safe}</tspan>`;
    case "muted": return `<tspan opacity="0.5">${safe}</tspan>`;
    case "accent":
    default: return `<tspan fill="${accent}">${safe}</tspan>`;
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wrapToLines(text: string, maxWidth: number, fontSize: number, isHeavy = false): string[] {
  // Respect explicit line breaks first
  const explicit = text.split(/\n+/);
  const out: string[] = [];
  // Approximate average glyph width for a display sans/serif at this size
  const avgCharWidth = fontSize * (isHeavy ? 0.58 : 0.52);
  const maxChars = Math.max(4, Math.floor(maxWidth / avgCharWidth));
  for (const block of explicit) {
    if (block.length <= maxChars) {
      out.push(block);
      continue;
    }
    const words = block.split(/\s+/);
    let line = "";
    for (const w of words) {
      const candidate = line ? line + " " + w : w;
      if (candidate.length > maxChars) {
        if (line) out.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out.slice(0, 4);
}

function wrapSubhead(text: string, maxWidth: number, fontSize: number, x: number): string {
  const avgCharWidth = fontSize * 0.5;
  const maxChars = Math.max(8, Math.floor(maxWidth / avgCharWidth));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? cur + " " + w : w;
    if (cand.length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = cand;
  }
  if (cur) lines.push(cur);
  return lines
    .slice(0, 3)
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : fontSize * 1.25}">${escapeXml(line)}</tspan>`)
    .join("");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeAttr(s: string): string {
  return s.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}

function isLightOver(bg: string, scrimOpacity: number): boolean {
  // After applying a dark scrim, the bottom area becomes dark — so text is light.
  if (scrimOpacity >= 0.4) return false;
  const lum = relLum(bg);
  return lum > 0.55;
}

function relLum(hex: string): number {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function lightest(tokens: BrandTokens): string {
  const opts = [tokens.palette.background, tokens.palette.surface, "#FFFFFF"];
  return opts.reduce((a, b) => (relLum(a) > relLum(b) ? a : b));
}

function darkest(tokens: BrandTokens): string {
  const opts = [tokens.palette.foreground, tokens.palette.primary, "#000000"];
  return opts.reduce((a, b) => (relLum(a) < relLum(b) ? a : b));
}
