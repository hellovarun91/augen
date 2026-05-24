import { z } from "zod";

export const Emphasis = z.object({
  word: z.string(),
  style: z.enum(["accent", "italic", "underline", "muted"]).default("accent"),
});
export type Emphasis = z.infer<typeof Emphasis>;

export const AdOverrides = z.object({
  typography: z.object({
    headlineScale: z.number().min(0.5).max(1.6).optional(),
    subheadScale: z.number().min(0.5).max(1.6).optional(),
    eyebrowScale: z.number().min(0.5).max(1.6).optional(),
    ctaScale: z.number().min(0.5).max(1.6).optional(),
    tracking: z.number().min(-0.06).max(0.04).optional(),
    headlineWeight: z.enum(["light", "regular", "medium", "semibold", "bold"]).optional(),
    emphasis: z.array(Emphasis).default([]),
  }).default({ emphasis: [] }),
  layout: z.object({
    ctaPosition: z.enum(["auto", "top-right", "bottom-right", "bottom-left", "inline-right"]).default("auto"),
    lockerVisible: z.boolean().default(true),
    scrimOpacity: z.number().min(0).max(1).optional(),     // overrides brand scrim
    scrimCoverage: z.number().min(0).max(1).optional(),
    headlineYShift: z.number().min(-0.3).max(0.3).default(0), // ± fraction of canvas height
    safePadding: z.number().min(0).max(0.2).optional(),     // fraction of short side
  }).default({ ctaPosition: "auto", lockerVisible: true, headlineYShift: 0 }),
  image: z.object({
    replaceUrl: z.string().optional(),       // public path under /refs/
    transparent: z.boolean().default(false), // user-uploaded transparent PNG (subject only)
    crop: z.object({
      panX: z.number().min(-1).max(1).default(0),   // fraction of width
      panY: z.number().min(-1).max(1).default(0),
      scale: z.number().min(0.5).max(3).default(1), // 1 = fit, >1 = zoom in
    }).default({ panX: 0, panY: 0, scale: 1 }),
    filter: z.enum(["none", "grayscale", "warm", "cool", "dark", "light"]).default("none"),
  }).default({ transparent: false, crop: { panX: 0, panY: 0, scale: 1 }, filter: "none" }),
  colors: z.object({
    eyebrow: z.string().optional(),
    headline: z.string().optional(),
    subhead: z.string().optional(),
    cta: z.string().optional(),
    rule: z.string().optional(),
  }).default({}),
  // Brand assets (logo/icon/badge) placed on this specific ad. x/y are the
  // centre as a fraction of canvas; scale is the box size as a fraction of width.
  placedAssets: z.array(z.object({
    assetId: z.string(),
    x: z.number().min(0).max(1).default(0.5),
    y: z.number().min(0).max(1).default(0.5),
    scale: z.number().min(0.03).max(0.9).default(0.18),
  })).default([]),
});
export type AdOverrides = z.infer<typeof AdOverrides>;

export function emptyOverrides(): AdOverrides {
  return AdOverrides.parse({});
}

export function parseOverrides(input: unknown): AdOverrides {
  if (!input) return emptyOverrides();
  try { return AdOverrides.parse(input); } catch { return emptyOverrides(); }
}

export function mergeOverrides(base: AdOverrides, patch: any): AdOverrides {
  // Deep merge, then re-parse to enforce schema bounds.
  function deep(a: any, b: any): any {
    if (b == null) return a;
    if (typeof b !== "object" || Array.isArray(b)) return b;
    const out: any = { ...a };
    for (const k of Object.keys(b)) out[k] = deep(a?.[k], b[k]);
    return out;
  }
  return AdOverrides.parse(deep(base, patch));
}
