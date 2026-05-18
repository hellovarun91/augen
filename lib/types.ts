import { z } from "zod";

export const BrandLanguage = z.object({
  voiceDescription: z.string().default(""),
  toneSliders: z.object({
    formal_casual: z.number().default(0),       // -1 formal, +1 casual
    serious_playful: z.number().default(0),     // -1 serious, +1 playful
    reserved_bold: z.number().default(0),       // -1 reserved, +1 bold
    classic_modern: z.number().default(0),      // -1 classic, +1 modern
  }).default({ formal_casual: 0, serious_playful: 0, reserved_bold: 0, classic_modern: 0 }),
  preferredWords: z.array(z.string()).default([]),
  bannedWords: z.array(z.string()).default([]),
  sampleSentences: z.array(z.string()).default([]),
  doRules: z.array(z.string()).default([]),
  doNotRules: z.array(z.string()).default([]),
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
  cost_cents: number;
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
