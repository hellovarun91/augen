// Resolves anchor-based layout to absolute pixel coordinates per format.
import type { BrandTokens } from "@/lib/types";
import type { AdOverrides } from "./overrides";

export type Aspect = "1:1" | "4:5" | "9:16" | "1.91:1" | "2:3" | "16:9" | "8:1" | "32:5" | "1:2" | "4:15" | "6:5" | "12:10";

export interface ResolvedLayout {
  width: number;
  height: number;
  safe: { x: number; y: number; w: number; h: number };
  eyebrow: { x: number; y: number; size: number; tracking: number };
  headline: { x: number; y: number; size: number; lineHeight: number; maxWidth: number; tracking: number };
  rule: { x: number; y: number; w: number; h: number };
  subhead: { x: number; y: number; size: number; maxWidth: number };
  cta: { x: number; y: number; size: number };
  locker: { x: number; y: number; size: number; align: "left" | "right" };
  scrim: { yStart: number; height: number };
  scale: number;
  copyOrientation: "vertical" | "horizontal";
}

export function resolveLayout(width: number, height: number, aspect: string, tokens: BrandTokens, ov?: AdOverrides): ResolvedLayout {
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  // base scale relative to 1080x1350 (4:5 reference)
  const scale = longSide / 1350;

  const isWide = width / height >= 1.7;
  const isVeryWide = width / height >= 3;
  const isTall = height / width >= 1.5;
  const isSmall = longSide < 500;

  const safePadOverride = ov?.layout?.safePadding;
  const padBase = safePadOverride != null
    ? Math.round(shortSide * safePadOverride)
    : isSmall ? 18 : 64 * Math.max(0.4, scale);
  const safe = {
    x: Math.round(padBase),
    y: Math.round(padBase * 0.9),
    w: Math.round(width - padBase * 2),
    h: Math.round(height - padBase * 1.8),
  };

  // Typography multipliers (per-ad operator tweaks)
  const tH = ov?.typography?.headlineScale ?? 1;
  const tS = ov?.typography?.subheadScale ?? 1;
  const tE = ov?.typography?.eyebrowScale ?? 1;
  const tC = ov?.typography?.ctaScale ?? 1;

  // Headline size dynamically scales with shortSide
  const baseHeadline = isSmall ? Math.round(shortSide * 0.13) : Math.round(shortSide * 0.10);
  const headlineSize = clamp(Math.round(baseHeadline * tH), 18, 320);
  const subheadSize = clamp(Math.round(headlineSize * 0.28 * tS), 11, 64);
  const eyebrowSize = clamp(Math.round(headlineSize * 0.18 * tE), 9, 40);
  const ctaSize = clamp(Math.round(headlineSize * 0.22 * tC), 10, 44);
  const lockerSize = clamp(Math.round(headlineSize * 0.18), 9, 30);

  const lineHeight = isSmall ? 1.0 : 0.94;

  // Decide vertical or horizontal copy orientation
  const orientation: "vertical" | "horizontal" =
    isVeryWide || isWide ? "horizontal" : "vertical";

  let layout: ResolvedLayout;

  if (orientation === "horizontal") {
    // banners / link / wide
    const textBlockW = Math.round(safe.w * (isVeryWide ? 0.7 : 0.62));
    layout = {
      width,
      height,
      safe,
      eyebrow: { x: safe.x, y: safe.y + eyebrowSize, size: eyebrowSize, tracking: 0.12 },
      headline: {
        x: safe.x,
        y: Math.round(safe.y + eyebrowSize + 28 + headlineSize * 0.8),
        size: headlineSize,
        lineHeight,
        maxWidth: textBlockW,
        tracking: tokens.type.tracking,
      },
      rule: { x: safe.x, y: safe.y + eyebrowSize + 10, w: Math.round(headlineSize * 0.7), h: 2 },
      subhead: {
        x: safe.x,
        y: Math.round(safe.y + safe.h - lockerSize - subheadSize - 10),
        size: subheadSize,
        maxWidth: textBlockW,
      },
      cta: { x: Math.round(width - safe.x), y: Math.round(safe.y + safe.h * 0.5 + ctaSize / 2), size: ctaSize },
      locker: { x: safe.x, y: Math.round(safe.y + safe.h), size: lockerSize, align: "left" },
      scrim: { yStart: 0, height },
      scale,
      copyOrientation: orientation,
    };
  } else {
    // 1:1, 4:5, 9:16, 2:3, 1:2 — copy stacks bottom-up
    const yShift = (ov?.layout?.headlineYShift ?? 0) * height;
    const headlineY = Math.round(safe.y + safe.h * 0.55 + yShift);
    const coverage = ov?.layout?.scrimCoverage ?? tokens.scrim.coverage;
    layout = {
      width,
      height,
      safe,
      eyebrow: { x: safe.x, y: Math.round(headlineY - headlineSize * 1.5), size: eyebrowSize, tracking: 0.14 },
      headline: {
        x: safe.x,
        y: headlineY,
        size: headlineSize,
        lineHeight,
        maxWidth: safe.w,
        tracking: ov?.typography?.tracking ?? tokens.type.tracking,
      },
      rule: { x: safe.x, y: Math.round(headlineY - headlineSize * 1.2), w: Math.round(headlineSize * 0.7), h: 2 },
      subhead: {
        x: safe.x,
        y: Math.round(safe.y + safe.h - lockerSize - subheadSize - 12),
        size: subheadSize,
        maxWidth: Math.round(safe.w * 0.72),
      },
      cta: { x: Math.round(safe.x + safe.w), y: Math.round(safe.y + safe.h - lockerSize - subheadSize - 12), size: ctaSize },
      locker: { x: safe.x, y: Math.round(safe.y + safe.h), size: lockerSize, align: "left" },
      scrim: { yStart: Math.round(height * (1 - coverage)), height: Math.round(height * coverage) },
      scale,
      copyOrientation: orientation,
    };
  }

  // CTA placement override (auto already set; replace if user picked a specific corner)
  const ctaPos = ov?.layout?.ctaPosition;
  if (ctaPos && ctaPos !== "auto") {
    const pad = padBase;
    if (ctaPos === "top-right") { layout.cta.x = width - pad; layout.cta.y = pad + layout.cta.size; }
    else if (ctaPos === "bottom-right") { layout.cta.x = width - pad; layout.cta.y = height - pad; }
    else if (ctaPos === "bottom-left") { layout.cta.x = pad + layout.cta.size * 5; layout.cta.y = height - pad; }
    else if (ctaPos === "inline-right") { layout.cta.x = width - pad; layout.cta.y = layout.headline.y + Math.round(layout.headline.size * 0.5); }
  }

  return layout;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
