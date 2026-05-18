import type { Brand, BrandLanguage, CampaignBrief, Idea } from "@/lib/types";

export type AgentKind = "strategist" | "art_director" | "copywriter" | "critic";

export interface AgentProvider {
  name: "mock" | "claude" | "gemini";
  model: string;
}

export interface AgentRunContext {
  chainId: string;
  parentRunId?: string;
  brandId: string;
  campaignId?: string;
  ideaId?: string;
  generationId?: string;
  provider: AgentProvider;
}

// ----- Strategist -----

export interface StrategistInput {
  brand: Brand;
  language: BrandLanguage;
  brief: CampaignBrief;
  quarter?: string;
  year?: number;
  count: number;
  notes?: string;
}

export interface StrategistIdea {
  theme: string;
  insight: string;
  angle: string;
  audience: string;
  promise: string;
  hooks: string[];
  visualDirection: string;
}

export interface StrategistOutput {
  rationale: string;
  ideas: StrategistIdea[];
}

// ----- Art Director -----

export interface ArtDirectorInput {
  brand: Brand;
  idea: Idea | StrategistIdea;
  product?: string;
  formatSlug: string;
  aspect: string;
  variantIndex: number;
  referencePool?: string[]; // paths or labels
  notes?: string;
}

export interface ArtDirectorOutput {
  rationale: string;
  subject: string;
  composition: string;
  lighting: string;
  styleKeyword: string;
  paletteEmphasis: string[];
  imagePrompt: string;
  refSuggestion?: string;
  seed: number;
}

// ----- Copywriter -----

export interface CopywriterInput {
  brand: Brand;
  language: BrandLanguage;
  idea: Idea | StrategistIdea;
  product?: string;
  formatSlug: string;
  variantIndex: number;
  count: number;
  constraints?: string;       // free text, e.g., "shorter", "lead with benefit"
  carryForward?: string[];    // headlines to *not* repeat
}

export interface CopyVariant {
  eyebrow: string;
  headline: string;
  subhead: string;
  cta: string;
}

export interface CopywriterOutput {
  rationale: string;
  variants: CopyVariant[];
}

// ----- Critic -----

export interface CriticInput {
  brand: Brand;
  language: BrandLanguage;
  formatSlug: string;
  copy: CopyVariant;
  idea?: Idea | StrategistIdea;
}

export interface CriticOutput {
  score: number;            // 0..1
  voiceFit: number;         // 0..1
  formatFit: number;        // 0..1
  conceptStrength: number;  // 0..1
  verdict: "ship" | "revise" | "kill";
  notes: string[];          // human-readable issues / wins
  revisionNote?: string;    // what to ask for if verdict = revise
}

export interface Agent<I, O> {
  kind: AgentKind;
  name: string;
  run(input: I, ctx?: AgentRunContext): Promise<O>;
}

export interface AgentRunRow {
  id: string;
  kind: AgentKind;
  chain_id: string | null;
  parent_run_id: string | null;
  brand_id: string | null;
  campaign_id: string | null;
  idea_id: string | null;
  generation_id: string | null;
  status: "pending" | "running" | "ok" | "failed";
  input_json: string;
  output_json: string | null;
  rationale: string | null;
  provider: string;
  model: string | null;
  duration_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  error: string | null;
  created_at: number;
}
