import Anthropic from "@anthropic-ai/sdk";
import type { Brand, BrandLanguage } from "@/lib/types";
import { listAnchorCopy, type AnchorCopy } from "@/lib/repo";
import { ALL_FORMATS } from "@/lib/formats";

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

// ---------------------------------------------------------------------------
// Static methodology block — the dominant cached prefix.
//
// Why this exists: Anthropic only caches a prefix once it clears a 1024-token
// minimum (Sonnet/Opus). The per-brand block alone is ~800–950 tokens, so the
// cached prefix never reached the minimum and caching silently no-op'd —
// every agent call re-billed full-price input for the same context.
//
// This block is identical for every agent, every brand, and every campaign, so
// once written it is read from cache by every subsequent call within the 5-min
// TTL (cache reads are ~10× cheaper than fresh input). It is intentionally
// substantial (well over 1024 tokens) so the prefix always clears the minimum.
// Keep it brand-agnostic — anything brand-specific belongs in brandSystemBlock.
let _methodology: string | null = null;
function methodologyText(): string {
  if (_methodology) return _methodology;

  const ergonomics = (aspect: string, w: number, h: number): string => {
    const ratio = w / h;
    if (ratio >= 3) return "ultra-wide banner — headline ≤28 chars, single line, no subhead crowding";
    if (ratio >= 1.5) return "landscape/link crop — headline ≤42 chars, one tight subhead";
    if (ratio >= 0.95 && ratio <= 1.05) return "square — 1–2 headline lines, balanced center weight";
    if (ratio <= 0.6) return "tall vertical — 2–3 stacked headline lines carry the rhythm";
    return "portrait — 2 stacked lines, generous vertical breathing room";
  };

  const catalog = ALL_FORMATS.map((f) =>
    `- ${f.name} [${f.slug}] · ${f.platform} ${f.placement} · ${f.width}×${f.height} (${f.aspect}) · ${ergonomics(f.aspect, f.width, f.height)}`,
  ).join("\n");

  _methodology = [
    "# Augen creative methodology (shared reference)",
    "You are one agent in a brand-design studio that produces finished advertising across many placements. Every agent shares these operating principles. Read them as the house style; the brand-specific block that follows refines them for this particular brand.",
    "",
    "## Operating principles",
    "1. Editorial over promotional. Write and direct as a confident magazine, not a hard-sell flyer. No exclamation pile-ups, no manufactured urgency, no category clichés.",
    "2. One idea per ad. A single insight, expressed plainly, beats three half-ideas crammed together. If you can't name the idea in a sentence, it isn't one yet.",
    "3. Voice is sacred. Banned words are never used, not even cleverly. Preferred words are reached for, not forced. Tone sliders are honored as a register, not a costume.",
    "4. Specificity beats abstraction. 'Hand-finished in small batches' outperforms 'premium quality'. Concrete nouns and verbs, few adjectives.",
    "5. Respect the crop. Copy length, line count, and visual weight must suit the placement's dimensions (see the catalog below). A line that sings in a 4:5 feed post breaks an 8:1 banner.",
    "6. Accessibility is not optional. Assume real contrast constraints; never rely on color alone to carry meaning.",
    "7. The brand's past winners are the strongest signal. When anchor examples are provided, new work should feel like a sibling — same register and rhythm, a fresh idea.",
    "",
    "## Role lenses",
    "- Strategist: turns a brief into a few strong ideas, each with a named insight, a specific audience, a promise, an angle, and a visual direction.",
    "- Art Director: turns an idea into one crisp, literal image prompt — composition, lighting, subject, palette emphasis — native to the brand. No logos or text baked into the image.",
    "- Copywriter: turns an idea + direction into ranked copy variants (eyebrow, headline, subhead, CTA) that obey the voice and the crop's character limits.",
    "- QC Critic: scores finished ads on voice fit, format ergonomics, and concept strength (0–1 each), then decides ship / revise / kill with short, specific notes.",
    "",
    "## Platform format catalog",
    "Each line: human name [slug] · platform & placement · pixel dimensions (aspect) · ergonomic guidance for copy length and layout.",
    catalog,
    "",
    "## Scoring rubric (for the QC Critic, and a quality bar for everyone)",
    "- voiceFit: does it sound unmistakably like this brand, honoring banned/preferred words and the tone profile?",
    "- formatFit: does headline length, line count, and rhythm suit this exact crop?",
    "- conceptStrength: is there a real, single idea — or is it generic filler that could front any brand?",
    "Most competent ads land 0.65–0.85. Reserve 0.9+ for work that is genuinely sharp. Be strict; flattery helps no one.",
  ].join("\n");
  return _methodology;
}

// Build the full system array for an agent call: [methodology, role, brand].
// Two cache breakpoints — the methodology block (shared app-wide) and the brand
// block (shared across one brand's calls). The role text rides inside the brand
// breakpoint's prefix. This is the single place the cache strategy lives.
export function agentSystem(
  role: string,
  brand: Brand,
  language: BrandLanguage,
): Anthropic.Messages.TextBlockParam[] {
  return [
    { type: "text", text: methodologyText(), cache_control: { type: "ephemeral" } },
    { type: "text", text: role },
    brandSystemBlock(brand, language),
  ];
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

  // Copywriter mechanics, directed swaps, and per-slot exemplars (guarded — older records may lack them).
  const sw = language.wordSwaps || [];
  const m: any = language.mechanics;
  const ex: any = language.exemplars;
  const exemplarBlock = ex && (ex.eyebrow?.length || ex.headline?.length || ex.subhead?.length || ex.cta?.length)
    ? "Voice exemplars by slot:\n" + [
        ex.headline?.length ? `Headlines: ${ex.headline.join(" / ")}` : "",
        ex.subhead?.length ? `Subheads: ${ex.subhead.join(" / ")}` : "",
        ex.eyebrow?.length ? `Eyebrows: ${ex.eyebrow.join(" / ")}` : "",
        ex.cta?.length ? `CTAs: ${ex.cta.join(" / ")}` : "",
      ].filter(Boolean).join("\n")
    : (language.sampleSentences.length ? `Voice-correct sample sentences:\n${language.sampleSentences.map((s) => `- ${s}`).join("\n")}` : "");

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
    sw.length ? `Word swaps (always prefer the second, never the first): ${sw.map((w: any) => `${w.from} → ${w.to}`).join("; ")}` : "",
    m ? `Style mechanics: headlines in ${m.headlineCase} case; exclamations ${m.exclamations}; emoji ${m.emoji}; ${m.oxfordComma ? "use the" : "no"} Oxford comma; numbers as ${m.numerals}; ${m.contractions === "avoid" ? "avoid" : "use"} contractions.${m.notes ? " " + m.notes : ""}` : "",
    language.doRules.length ? `Do: ${language.doRules.map((r) => `\n- ${r}`).join("")}` : "",
    language.doNotRules.length ? `Do not: ${language.doNotRules.map((r) => `\n- ${r}`).join("")}` : "",
    exemplarBlock,
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
