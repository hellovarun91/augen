import type { BrandTokens } from "@/lib/types";
import { buildBackground } from "./background";
import { resolveLayout } from "./layout";

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
}

export function renderAdSvg(args: RenderArgs): string {
  const { width, height, aspect, tokens, copy, seed, style } = args;
  const layout = resolveLayout(width, height, aspect, tokens);
  const palette = [
    tokens.palette.background,
    tokens.palette.surface,
    tokens.palette.foreground,
    tokens.palette.primary,
    tokens.palette.secondary,
    tokens.palette.accent,
    tokens.palette.muted,
  ];

  const bg = args.bareBackground
    ? `<rect width="${width}" height="${height}" fill="${tokens.palette.background}"/>`
    : buildBackground({ width, height, seed, palette, style });

  const scrim = args.showScrim !== false ? buildScrim(width, layout.scrim.yStart, layout.scrim.height, tokens) : "";

  const onLight = isLightOver(tokens.palette.background, tokens.scrim.bottomOpacity);
  const fg = onLight ? darkest(tokens) : lightest(tokens);
  const accentColor = tokens.palette.accent;

  const text = buildText(layout, tokens, copy, fg, accentColor, args.showLocker !== false);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet">
${bg}
${scrim}
${text}
</svg>`;
}

function buildScrim(width: number, yStart: number, h: number, tokens: BrandTokens): string {
  const tint = tokens.scrim.tint || "#000000";
  const id = "scrim_grad";
  return `<defs>
  <linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0%" stop-color="${tint}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${tint}" stop-opacity="${tokens.scrim.bottomOpacity}"/>
  </linearGradient>
</defs>
<rect x="0" y="${yStart}" width="${width}" height="${h}" fill="url(#${id})"/>`;
}

function buildText(
  layout: ReturnType<typeof resolveLayout>,
  tokens: BrandTokens,
  copy: { eyebrow?: string; headline: string; subhead?: string; cta: string },
  fg: string,
  accent: string,
  showLocker: boolean,
): string {
  const displayFamily = escapeAttr(tokens.fonts.display);
  const bodyFamily = escapeAttr(tokens.fonts.body);
  const headlineSize = layout.headline.size;
  const lines = wrapToLines(copy.headline, layout.headline.maxWidth, headlineSize, /heavy/i.test(displayFamily));
  const headlineY = layout.headline.y;

  const headlineTspans = lines
    .map((line, i) => `<tspan x="${layout.headline.x}" dy="${i === 0 ? 0 : headlineSize * layout.headline.lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  const eyebrow = copy.eyebrow
    ? `<text x="${layout.eyebrow.x}" y="${layout.eyebrow.y}" font-family='${bodyFamily}' font-size="${layout.eyebrow.size}" font-weight="600" letter-spacing="${(layout.eyebrow.tracking * layout.eyebrow.size).toFixed(2)}" fill="${fg}">${escapeXml(copy.eyebrow)}</text>`
    : "";

  const rule = `<rect x="${layout.rule.x}" y="${layout.rule.y}" width="${layout.rule.w}" height="${layout.rule.h}" fill="${accent}"/>`;

  const headline = `<text x="${layout.headline.x}" y="${headlineY}" font-family='${displayFamily}' font-size="${headlineSize}" font-weight="500" letter-spacing="${(layout.headline.tracking * headlineSize).toFixed(2)}" fill="${fg}">${headlineTspans}</text>`;

  const subhead = copy.subhead
    ? `<text x="${layout.subhead.x}" y="${layout.subhead.y}" font-family='${bodyFamily}' font-size="${layout.subhead.size}" font-weight="400" fill="${fg}">${wrapSubhead(copy.subhead, layout.subhead.maxWidth, layout.subhead.size, layout.subhead.x)}</text>`
    : "";

  const cta = `<text x="${layout.cta.x}" y="${layout.cta.y}" font-family='${bodyFamily}' font-size="${layout.cta.size}" font-weight="600" text-anchor="end" fill="${fg}">${escapeXml(copy.cta)} →</text>`;

  const locker = showLocker
    ? `<text x="${layout.locker.x}" y="${layout.locker.y}" font-family='${bodyFamily}' font-size="${layout.locker.size}" font-weight="700" letter-spacing="${(0.16 * layout.locker.size).toFixed(2)}" fill="${fg}">${escapeXml(tokens.locker.wordmark)}</text>`
    : "";

  return [eyebrow, rule, headline, subhead, cta, locker].join("\n");
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
