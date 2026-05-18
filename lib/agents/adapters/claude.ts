import Anthropic from "@anthropic-ai/sdk";
import type { Brand, BrandLanguage } from "@/lib/types";
import { listAnchorCopy, type AnchorCopy } from "@/lib/repo";

let _client: Anthropic | null = null;

export function getClaude(): Anthropic | null {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  // Hard-cap check: if ANTHROPIC_BUDGET_USD is set and exceeded, treat as mock.
  // We require lazily inside this function so the persistence module is available at call time.
  try {
    const { withinClaudeBudget } = require("@/lib/ratelimit");
    const status = withinClaudeBudget();
    if (!status.allowed) {
      console.warn(`[claude] budget exceeded ($${status.spentUsd?.toFixed(2)} / $${status.budgetUsd}) — falling back to mock`);
      return null;
    }
  } catch {}
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

// Common cache-stable block: brand identity + language profile + anchor examples.
// Returned as a system text block with cache_control set so Claude caches it across calls.
export function brandSystemBlock(brand: Brand, language: BrandLanguage): Anthropic.Messages.TextBlockParam {
  const tone = language.toneSliders;
  const tonePhrase = [
    `formal↔casual ${tone.formal_casual.toFixed(2)}`,
    `serious↔playful ${tone.serious_playful.toFixed(2)}`,
    `reserved↔bold ${tone.reserved_bold.toFixed(2)}`,
    `classic↔modern ${tone.classic_modern.toFixed(2)}`,
  ].join("; ");

  // Anchor examples — the learning loop. Stable across calls; grow as ads get approved / winners get loaded.
  const anchors = listAnchorCopy(brand.id, 10);
  const anchorBlock = anchors.length ? formatAnchors(anchors) : "";

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
    anchorBlock,
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

function formatAnchors(anchors: AnchorCopy[]): string {
  const winners = anchors.filter((a) => a.source === "winner");
  const approved = anchors.filter((a) => a.source === "approved");
  const starred = anchors.filter((a) => a.source === "starred");
  const sections: string[] = [];
  if (winners.length) sections.push(formatSection("Past winners (field-validated — match this register)", winners));
  if (approved.length) sections.push(formatSection("Recently approved (the operator shipped these)", approved));
  if (starred.length) sections.push(formatSection("Starred in Copy Lab (operator marked as voice-correct)", starred));
  return sections.length ? `\n# Anchor examples\nThese are voice-confirmed past ads for this brand. New work should *feel like a sibling* — same register, same rhythm, fresh idea.\n\n${sections.join("\n\n")}` : "";
}

function formatSection(title: string, items: AnchorCopy[]): string {
  return `## ${title}\n` + items.slice(0, 6).map((a) => {
    const parts: string[] = [];
    if (a.eyebrow) parts.push(`eyebrow: ${a.eyebrow}`);
    parts.push(`headline: ${a.headline.replace(/\n/g, " / ")}`);
    if (a.subhead) parts.push(`subhead: ${a.subhead}`);
    if (a.cta) parts.push(`cta: ${a.cta}`);
    if (a.format_slug) parts.push(`(format: ${a.format_slug}${a.metric_label ? `, ${a.metric_label}` : ""})`);
    return `- ${parts.join(" · ")}`;
  }).join("\n");
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

// Helper: pull token usage from a Claude response in a shape recordRun accepts.
export function extractUsage(resp: Anthropic.Messages.Message) {
  const u: any = resp.usage || {};
  return {
    input_tokens: u.input_tokens || 0,
    output_tokens: u.output_tokens || 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
    cache_read_input_tokens: u.cache_read_input_tokens || 0,
  };
}
