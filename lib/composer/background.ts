import { rng } from "@/lib/ai/rand";

interface BgParams {
  width: number;
  height: number;
  seed: number;
  palette: string[]; // background, surface, foreground, primary, secondary, accent, muted (any subset)
  style: string;
}

// Generates a sophisticated "photographic-feel" background as SVG markup.
// Uses overlapping radial gradients, soft shapes, grain, and a faint vignette.
export function buildBackground({ width, height, seed, palette, style }: BgParams): string {
  const r = rng(seed);
  const [bg, surface, fg, primary, secondary, accent] = ensurePalette(palette);

  // Choose composition mode based on style
  const mode = pickMode(style, r);

  const defs: string[] = [];
  const layers: string[] = [];

  // Base wash
  layers.push(`<rect width="${width}" height="${height}" fill="${bg}"/>`);

  // Atmosphere: two large soft radial gradients
  const atm1Cx = Math.floor(width * (0.2 + r() * 0.4));
  const atm1Cy = Math.floor(height * (0.2 + r() * 0.4));
  const atm1R = Math.floor(Math.max(width, height) * (0.65 + r() * 0.4));
  defs.push(`
    <radialGradient id="atm1" cx="${atm1Cx}" cy="${atm1Cy}" r="${atm1R}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${withAlpha(surface, 0.85)}"/>
      <stop offset="60%" stop-color="${withAlpha(surface, 0.25)}"/>
      <stop offset="100%" stop-color="${withAlpha(surface, 0)}"/>
    </radialGradient>`);
  layers.push(`<rect width="${width}" height="${height}" fill="url(#atm1)"/>`);

  const atm2Cx = Math.floor(width * (0.55 + r() * 0.4));
  const atm2Cy = Math.floor(height * (0.55 + r() * 0.4));
  const atm2R = Math.floor(Math.max(width, height) * (0.5 + r() * 0.35));
  defs.push(`
    <radialGradient id="atm2" cx="${atm2Cx}" cy="${atm2Cy}" r="${atm2R}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${withAlpha(primary, 0.55)}"/>
      <stop offset="55%" stop-color="${withAlpha(primary, 0.18)}"/>
      <stop offset="100%" stop-color="${withAlpha(primary, 0)}"/>
    </radialGradient>`);
  layers.push(`<rect width="${width}" height="${height}" fill="url(#atm2)"/>`);

  // Mode-specific shapes
  if (mode === "tabletop") {
    layers.push(...tabletop(width, height, r, { bg, surface, fg, primary, secondary, accent }));
  } else if (mode === "blocked") {
    layers.push(...blocked(width, height, r, { bg, surface, fg, primary, secondary, accent }));
  } else if (mode === "macro") {
    layers.push(...macro(width, height, r, { bg, surface, fg, primary, secondary, accent }));
  } else if (mode === "horizon") {
    layers.push(...horizon(width, height, r, { bg, surface, fg, primary, secondary, accent }));
  } else if (mode === "duotone") {
    layers.push(...duotone(width, height, r, { bg, surface, fg, primary, secondary, accent }));
  } else {
    // editorial / fallback
    layers.push(...editorial(width, height, r, { bg, surface, fg, primary, secondary, accent }));
  }

  // Soft global grain (very subtle), via filter feTurbulence
  defs.push(`
    <filter id="grain" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="${(0.85 + r() * 0.5).toFixed(2)}" numOctaves="2" seed="${seed % 1000}" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.07 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>`);
  layers.push(`<rect width="${width}" height="${height}" fill="white" filter="url(#grain)"/>`);

  // Vignette
  defs.push(`
    <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
      <stop offset="55%" stop-color="black" stop-opacity="0"/>
      <stop offset="100%" stop-color="black" stop-opacity="0.35"/>
    </radialGradient>`);
  layers.push(`<rect width="${width}" height="${height}" fill="url(#vignette)"/>`);

  return `<defs>${defs.join("\n")}</defs>\n${layers.join("\n")}`;
}

function pickMode(style: string, r: () => number): string {
  const map: Record<string, string[]> = {
    editorial: ["tabletop", "horizon", "editorial"],
    minimalist: ["blocked", "duotone"],
    vibrant: ["blocked", "duotone", "editorial"],
    moody: ["editorial", "macro", "tabletop"],
    premium: ["tabletop", "editorial", "horizon"],
    playful: ["blocked", "duotone"],
    industrial: ["macro", "duotone"],
    natural: ["horizon", "editorial", "macro"],
  };
  const list = map[style] || map.editorial;
  return list[Math.floor(r() * list.length)];
}

type Pal = { bg: string; surface: string; fg: string; primary: string; secondary: string; accent: string };

function tabletop(w: number, h: number, r: () => number, p: Pal): string[] {
  // Horizon line + table surface + object discs
  const horizonY = Math.floor(h * (0.58 + r() * 0.14));
  const out: string[] = [];
  // back wall
  out.push(`<rect x="0" y="0" width="${w}" height="${horizonY}" fill="${withAlpha(p.surface, 0.55)}"/>`);
  // table
  out.push(`<rect x="0" y="${horizonY}" width="${w}" height="${h - horizonY}" fill="${withAlpha(p.bg, 0.0)}"/>`);
  // table shadow gradient
  const tg = `tg_${Math.floor(r() * 1e6)}`;
  // soft shadow under the imaginary subject
  const cx = Math.floor(w * (0.32 + r() * 0.36));
  const cy = horizonY + Math.floor((h - horizonY) * 0.18);
  out.push(`<ellipse cx="${cx}" cy="${cy + 60}" rx="${Math.floor(w * 0.22)}" ry="${Math.floor((h - horizonY) * 0.12)}" fill="${withAlpha("#000000", 0.18)}"/>`);
  // light pool from upper-left
  out.push(`<ellipse cx="${Math.floor(w * 0.18)}" cy="${Math.floor(horizonY * 0.25)}" rx="${Math.floor(w * 0.35)}" ry="${Math.floor(h * 0.18)}" fill="${withAlpha("#FFF6E0", 0.18)}"/>`);
  // subject suggestion — soft disc with secondary
  out.push(`<circle cx="${cx}" cy="${cy}" r="${Math.floor(Math.min(w, h) * 0.13)}" fill="${withAlpha(p.primary, 0.55)}"/>`);
  out.push(`<circle cx="${cx - 4}" cy="${cy - 8}" r="${Math.floor(Math.min(w, h) * 0.115)}" fill="${withAlpha(p.accent, 0.5)}"/>`);
  return out;
}

function blocked(w: number, h: number, r: () => number, p: Pal): string[] {
  const out: string[] = [];
  const split = 0.35 + r() * 0.3;
  out.push(`<rect x="0" y="0" width="${Math.floor(w * split)}" height="${h}" fill="${p.primary}"/>`);
  out.push(`<rect x="${Math.floor(w * split)}" y="0" width="${w - Math.floor(w * split)}" height="${h}" fill="${p.surface}"/>`);
  const angle = r() > 0.5 ? 12 : -12;
  out.push(`<g transform="translate(${Math.floor(w * split)} ${Math.floor(h * (0.3 + r() * 0.3))}) rotate(${angle})">
    <rect x="-${Math.floor(w * 0.18)}" y="-${Math.floor(h * 0.1)}" width="${Math.floor(w * 0.5)}" height="${Math.floor(h * 0.22)}" fill="${withAlpha(p.accent, 0.92)}"/>
  </g>`);
  out.push(`<circle cx="${Math.floor(w * (0.3 + r() * 0.3))}" cy="${Math.floor(h * (0.65 + r() * 0.2))}" r="${Math.floor(Math.min(w, h) * 0.12)}" fill="${withAlpha(p.secondary, 0.9)}"/>`);
  return out;
}

function macro(w: number, h: number, r: () => number, p: Pal): string[] {
  const out: string[] = [];
  // Several large semitransparent circles to suggest macro bokeh
  for (let i = 0; i < 9; i++) {
    const cx = Math.floor(r() * w);
    const cy = Math.floor(r() * h);
    const rad = Math.floor((0.15 + r() * 0.35) * Math.min(w, h));
    const colors = [p.primary, p.accent, p.secondary, p.surface];
    const c = colors[i % colors.length];
    out.push(`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${withAlpha(c, 0.18 + r() * 0.18)}"/>`);
  }
  return out;
}

function horizon(w: number, h: number, r: () => number, p: Pal): string[] {
  const out: string[] = [];
  const horizonY = Math.floor(h * (0.55 + r() * 0.15));
  const skyGrad = `sky_${Math.floor(r() * 1e6)}`;
  out.push(`<defs><linearGradient id="${skyGrad}" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0%" stop-color="${withAlpha(p.primary, 0.85)}"/>
    <stop offset="100%" stop-color="${withAlpha(p.surface, 1)}"/>
  </linearGradient></defs>`);
  out.push(`<rect x="0" y="0" width="${w}" height="${horizonY}" fill="url(#${skyGrad})"/>`);
  out.push(`<rect x="0" y="${horizonY}" width="${w}" height="${h - horizonY}" fill="${p.bg}"/>`);
  // sun
  const sunX = Math.floor(w * (0.2 + r() * 0.6));
  const sunY = Math.floor(horizonY * (0.45 + r() * 0.35));
  out.push(`<circle cx="${sunX}" cy="${sunY}" r="${Math.floor(Math.min(w, h) * 0.14)}" fill="${withAlpha(p.accent, 0.95)}"/>`);
  out.push(`<circle cx="${sunX}" cy="${sunY}" r="${Math.floor(Math.min(w, h) * 0.24)}" fill="${withAlpha(p.accent, 0.18)}"/>`);
  return out;
}

function duotone(w: number, h: number, r: () => number, p: Pal): string[] {
  const out: string[] = [];
  // Two big overlapping gradients
  const g1 = `dt1_${Math.floor(r() * 1e6)}`;
  const g2 = `dt2_${Math.floor(r() * 1e6)}`;
  const ang1 = Math.floor(r() * 360);
  out.push(`<defs>
    <linearGradient id="${g1}" gradientTransform="rotate(${ang1})">
      <stop offset="0%" stop-color="${p.primary}"/>
      <stop offset="100%" stop-color="${p.accent}"/>
    </linearGradient>
    <radialGradient id="${g2}" cx="${50 + Math.floor(r() * 30)}%" cy="${30 + Math.floor(r() * 40)}%" r="70%">
      <stop offset="0%" stop-color="${withAlpha(p.secondary, 0.75)}"/>
      <stop offset="100%" stop-color="${withAlpha(p.secondary, 0)}"/>
    </radialGradient>
  </defs>`);
  out.push(`<rect width="${w}" height="${h}" fill="url(#${g1})"/>`);
  out.push(`<rect width="${w}" height="${h}" fill="url(#${g2})"/>`);
  return out;
}

function editorial(w: number, h: number, r: () => number, p: Pal): string[] {
  const out: string[] = [];
  // Diagonal soft beam
  const beamAngle = -20 + Math.floor(r() * 40);
  out.push(`<g transform="translate(${Math.floor(w * 0.5)} ${Math.floor(h * 0.5)}) rotate(${beamAngle}) translate(-${Math.floor(w * 0.5)} -${Math.floor(h * 0.5)})">
    <rect x="-${w}" y="${Math.floor(h * (0.2 + r() * 0.3))}" width="${w * 3}" height="${Math.floor(h * 0.18)}" fill="${withAlpha("#FFF6E0", 0.16)}"/>
  </g>`);
  // Round object
  const cx = Math.floor(w * (0.55 + r() * 0.25));
  const cy = Math.floor(h * (0.55 + r() * 0.25));
  out.push(`<circle cx="${cx}" cy="${cy}" r="${Math.floor(Math.min(w, h) * 0.14)}" fill="${withAlpha(p.primary, 0.85)}"/>`);
  out.push(`<circle cx="${cx + 12}" cy="${cy + 12}" r="${Math.floor(Math.min(w, h) * 0.085)}" fill="${withAlpha(p.accent, 0.85)}"/>`);
  // Soft horizon — slight tint to ground the bottom band
  const hy = Math.floor(h * (0.62 + r() * 0.15));
  out.push(`<rect x="0" y="${hy}" width="${w}" height="${h - hy}" fill="${withAlpha(p.fg, 0.05)}"/>`);
  return out;
}

function ensurePalette(p: string[]): string[] {
  const fallback = ["#F2EBDC", "#E8D9B8", "#1A1815", "#1F4A47", "#C9A45C", "#D85A3A", "#8C8478"];
  const out = [...p];
  while (out.length < 7) out.push(fallback[out.length]);
  return out;
}

function withAlpha(hex: string, alpha: number): string {
  // Accept #RRGGBB or short
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const a = Math.max(0, Math.min(1, alpha));
  const aHex = Math.round(a * 255).toString(16).padStart(2, "0");
  return `#${full}${aHex}`;
}
