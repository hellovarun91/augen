import { z } from "zod";

export const BrandLanguage = z.object({
  voiceDescription: z.string().default(""),
  toneSliders: z.object({
    formal_casual: z.number().default(0),
    serious_playful: z.number().default(0),
    reserved_bold: z.number().default(0),
    classic_modern: z.number().default(0),
  }).default({ formal_casual: 0, serious_playful: 0, reserved_bold: 0, classic_modern: 0 }),
  preferredWords: z.array(z.string()).default([]),
  bannedWords: z.array(z.string()).default([]),
  sampleSentences: z.array(z.string()).default([]),
  doRules: z.array(z.string()).default([]),
  doNotRules: z.array(z.string()).default([]),
  copyLimits: z.object({
    headlineMaxChars: z.number().int().min(8).max(200).default(48),
    subheadMaxChars: z.number().int().min(20).max(400).default(120),
    ctaMaxChars: z.number().int().min(4).max(40).default(24),
    eyebrowMaxChars: z.number().int().min(2).max(40).default(18),
  }).default({ headlineMaxChars: 48, subheadMaxChars: 120, ctaMaxChars: 24, eyebrowMaxChars: 18 }),
  // Durable brand mechanics — the conventions copywriters keep consistent.
  mechanics: z.object({
    headlineCase: z.enum(["sentence", "title", "lower"]).default("sentence"),
    exclamations: z.enum(["never", "sparing", "ok"]).default("sparing"),
    emoji: z.enum(["never", "sparing", "ok"]).default("never"),
    oxfordComma: z.boolean().default(true),
    numerals: z.enum(["numerals", "spell-small", "words"]).default("numerals"),
    contractions: z.enum(["use", "avoid"]).default("use"),
    notes: z.string().default(""),
  }).default({ headlineCase: "sentence", exclamations: "sparing", emoji: "never", oxfordComma: true, numerals: "numerals", contractions: "use", notes: "" }),
  // Directed rewrites: prefer `to` over `from`.
  wordSwaps: z.array(z.object({ from: z.string(), to: z.string() })).default([]),
  // Voice exemplars anchored per slot.
  exemplars: z.object({
    eyebrow: z.array(z.string()).default([]),
    headline: z.array(z.string()).default([]),
    subhead: z.array(z.string()).default([]),
    cta: z.array(z.string()).default([]),
  }).default({ eyebrow: [], headline: [], subhead: [], cta: [] }),
});
export type BrandLanguage = z.infer<typeof BrandLanguage>;

export const BrandTokens = z.object({
  name: z.string(),
  semver: z.string().default("1.0.0"),
  palette: z.object({
    background: z.string(),
    surface: z.string(),
    foreground: z.string(),
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    muted: z.string(),
  }),
  fonts: z.object({
    display: z.string(),
    body: z.string(),
    mono: z.string().optional(),
  }),
  type: z.object({
    eyebrowSize: z.number().default(18),
    headlineSize: z.number().default(96),
    subheadSize: z.number().default(28),
    ctaSize: z.number().default(20),
    lockerSize: z.number().default(16),
    tracking: z.number().default(-0.02),
  }),
  scrim: z.object({
    topOpacity: z.number().default(0.0),
    midOpacity: z.number().default(0.15),
    bottomOpacity: z.number().default(0.55),
    coverage: z.number().default(0.6),
    tint: z.string().default("#000000"),
  }),
  voice: z.object({
    description: z.string(),
    doNot: z.array(z.string()).default([]),
    tone: z.array(z.string()).default([]),
  }),
  locker: z.object({
    wordmark: z.string(),
    locationLine: z.string().optional().default(""),
  }),
  imagery: z.object({
    style: z.enum([
      "editorial",
      "minimalist",
      "vibrant",
      "moody",
      "premium",
      "playful",
      "industrial",
      "natural",
    ]).default("editorial"),
    treatment: z.string().default("Soft natural light with shallow depth of field."),
    keywords: z.array(z.string()).default([]),
  }),
});
export type BrandTokens = z.infer<typeof BrandTokens>;

export interface BrandRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  industry: string | null;
  description: string | null;
  voice: string | null;
  tokens: string;
  refs: string | null;
  status: string;
  language: string | null;
  created_at: number;
  updated_at: number;
}

export interface Brand extends Omit<BrandRow, "tokens" | "refs" | "language"> {
  tokens: BrandTokens;
  refs: string[];
  language: BrandLanguage;
}

export interface CampaignBrief {
  objective: string;
  audience: string;
  productFocus: string[];
  channels: string[];
  formats: string[];
  budget: number;
  kpis: string[];
  notes?: string;
}

export interface IdeaRow {
  id: string;
  campaign_id: string;
  theme: string;
  insight: string | null;
  angle: string;
  audience: string;
  promise: string | null;
  hooks: string | null;
  visual_direction: string | null;
  selected: number;
  order_idx: number;
  created_at: number;
}

export interface Idea extends Omit<IdeaRow, "hooks"> {
  hooks: string[];
}

export interface CampaignRow {
  id: string;
  brand_id: string;
  name: string;
  quarter: string | null;
  year: number | null;
  objective: string | null;
  audience: string | null;
  brief: string;
  template_id: string | null;
  status: string;
  signed_off_by: string | null;
  signed_off_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface Campaign extends Omit<CampaignRow, "brief"> {
  brief: CampaignBrief;
}

export interface GenerationRow {
  id: string;
  campaign_id: string;
  idea_id: string | null;
  brand_id: string;
  format_slug: string;
  aspect: string;
  width: number;
  height: number;
  headline: string;
  subhead: string | null;
  cta: string;
  eyebrow: string | null;
  copy_json: string | null;
  image_prompt: string | null;
  image_seed: number;
  image_style: string | null;
  palette: string | null;
  status: string;
  confidence: number;
  notes: string | null;
  design_score: number | null;
  design_notes: string | null;
  cost_cents: number;
  copy_row_id: string | null; // source Copy Sheet row, when fanned out (#47)
  stale: number;              // 1 = copy diverged from its row; needs re-render (#49)
  created_at: number;
  updated_at: number;
}

export interface Generation extends Omit<GenerationRow, "copy_json" | "palette"> {
  copy: { headline: string; subhead: string; cta: string; eyebrow?: string }[];
  palette: string[];
}

export interface FormatRow {
  id: string;
  slug: string;
  name: string;
  platform: string;
  aspect: string;
  width: number;
  height: number;
  placement: string | null;
}
