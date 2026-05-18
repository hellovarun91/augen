import Anthropic from "@anthropic-ai/sdk";
import type { Brand, BrandLanguage } from "@/lib/types";

let _client: Anthropic | null = null;

export function getClaude(): Anthropic | null {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export function claudeModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
}

export function claudeMaxTokens(): number {
  const v = process.env.ANTHROPIC_MAX_TOKENS;
  return v ? parseInt(v, 10) : 4096;
}

// Common cache-stable block: brand identity + language profile.
// Returned as a system text block with cache_control set so Claude caches it across calls.
export function brandSystemBlock(brand: Brand, language: BrandLanguage): Anthropic.Messages.TextBlockParam {
  const tone = language.toneSliders;
  const tonePhrase = [
    `formal↔casual ${tone.formal_casual.toFixed(2)}`,
    `serious↔playful ${tone.serious_playful.toFixed(2)}`,
    `reserved↔bold ${tone.reserved_bold.toFixed(2)}`,
    `classic↔modern ${tone.classic_modern.toFixed(2)}`,
  ].join("; ");

  const text = [
    `# Brand: ${brand.name}`,
    `Industry: ${brand.industry || "unspecified"}`,
    brand.tagline ? `Tagline: ${brand.tagline}` : "",
    `Description: ${brand.description || "—"}`,
    "",
    `# Voice`,
    `Description: ${language.voiceDescription || brand.tokens.voice.description}`,
    `Tone profile: ${tonePhrase}`,
    language.preferredWords.length ? `Preferred words: ${language.preferredWords.join(", ")}` : "",
    language.bannedWords.length ? `Banned words (MUST avoid): ${language.bannedWords.join(", ")}` : "",
    language.doRules.length ? `Do: ${language.doRules.map((r) => `\n- ${r}`).join("")}` : "",
    language.doNotRules.length ? `Do not: ${language.doNotRules.map((r) => `\n- ${r}`).join("")}` : "",
    language.sampleSentences.length ? `Voice-correct sample sentences:\n${language.sampleSentences.map((s) => `- ${s}`).join("\n")}` : "",
    "",
    `# Imagery`,
    `Style: ${brand.tokens.imagery.style}`,
    `Treatment: ${brand.tokens.imagery.treatment}`,
    "",
    `# Palette`,
    `Background ${brand.tokens.palette.background}; Surface ${brand.tokens.palette.surface}; Foreground ${brand.tokens.palette.foreground}; Primary ${brand.tokens.palette.primary}; Accent ${brand.tokens.palette.accent}.`,
  ].filter(Boolean).join("\n");

  return { type: "text", text, cache_control: { type: "ephemeral" } };
}

export interface ClaudeStatus {
  enabled: boolean;
  model: string;
  reason?: string;
}

export function claudeStatus(): ClaudeStatus {
  if (!process.env.ANTHROPIC_API_KEY) return { enabled: false, model: claudeModel(), reason: "ANTHROPIC_API_KEY not set" };
  return { enabled: true, model: claudeModel() };
}

// Helper: extract a tool_use input by name from a Claude response, or throw.
export function extractToolUse<T = any>(resp: Anthropic.Messages.Message, toolName: string): T {
  for (const block of resp.content) {
    if (block.type === "tool_use" && block.name === toolName) {
      return block.input as T;
    }
  }
  throw new Error(`Claude did not call tool ${toolName}. Stop reason: ${resp.stop_reason}`);
}
