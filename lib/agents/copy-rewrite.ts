import type { Brand } from "@/lib/types";
import { agentSystem, claudeModel, claudeMaxTokens, extractToolUse, getClaude } from "./adapters/claude";

export type RewriteAction = "punchier" | "shorter" | "match_voice";
export type Layer = "headline" | "subhead" | "cta" | "eyebrow" | "other";

const ACTION_DIRECTION: Record<RewriteAction, string> = {
  punchier: "Make it punchier — more direct, more impact, fewer hedge words. Keep the same message and roughly the same length.",
  shorter: "Cut it to roughly 60% of the current length. Keep the strongest idea. Same message, fewer words.",
  match_voice: "Rewrite to fit this brand's voice exactly. Same message, brand's cadence and word choice.",
};

export interface RewriteInput {
  brand: Brand;
  layer: Layer;
  currentText: string;
  action: RewriteAction;
  maxChars?: number;
  context: { headline?: string; subhead?: string; cta?: string; eyebrow?: string; rowName?: string };
}

export interface RewriteOutput { proposed: string; rationale: string }

// Rewrites one cell of ad copy. Claude when available, a small heuristic
// fallback otherwise — so the in-cell ✨ menu always returns something.
export async function rewriteCellCopy(input: RewriteInput): Promise<RewriteOutput> {
  if (getClaude()) {
    try { return await rewriteWithClaude(input); }
    catch (e: any) { console.warn("[copy-rewrite] Claude failed, falling back:", e?.message || e); }
  }
  return rewriteHeuristic(input);
}

async function rewriteWithClaude(input: RewriteInput): Promise<RewriteOutput> {
  const client = getClaude()!;
  const tokens = (input.brand as any).tokens;
  const system = agentSystem(
    `You rewrite ONE line of ad copy. You keep the message intact — you change ONLY the style or length as directed. No quotes around the output. No markdown. Just the line.`,
    input.brand,
    (input.brand as any).language || tokens?.voice,
  );

  const userText = [
    `Action: ${input.action}. ${ACTION_DIRECTION[input.action]}`,
    `Field: ${input.layer}`,
    input.maxChars ? `Hard cap: ${input.maxChars} characters.` : "",
    input.context.rowName ? `This line is part of the variation named: "${input.context.rowName}".` : "",
    "",
    "Other lines in this variation (for context only — do NOT rewrite them):",
    input.context.eyebrow ? `  eyebrow: ${input.context.eyebrow}` : "",
    input.context.headline ? `  headline: ${input.context.headline}` : "",
    input.context.subhead ? `  subhead: ${input.context.subhead}` : "",
    input.context.cta ? `  cta: ${input.context.cta}` : "",
    "",
    `Current text: "${input.currentText}"`,
    "",
    "Emit the rewritten line and a one-sentence rationale.",
  ].filter(Boolean).join("\n");

  const resp = await client.messages.create({
    model: claudeModel(),
    max_tokens: Math.min(claudeMaxTokens(), 600),
    system,
    messages: [{ role: "user", content: userText }],
    tools: [{
      name: "emit_rewrite",
      description: "Return the rewritten line and a brief rationale.",
      input_schema: {
        type: "object",
        properties: {
          proposed: { type: "string", description: "The rewritten line. Plain text only." },
          rationale: { type: "string", description: "One sentence explaining the change." },
        },
        required: ["proposed", "rationale"],
      },
    }],
    tool_choice: { type: "tool", name: "emit_rewrite" },
  });

  const out = extractToolUse<RewriteOutput>(resp, "emit_rewrite");
  return { proposed: cleanProposed(out.proposed, input.maxChars), rationale: out.rationale || "" };
}

// Light fallbacks so the action still works without a Claude key.
function rewriteHeuristic(input: RewriteInput): RewriteOutput {
  const t = input.currentText.trim();
  if (!t) return { proposed: "", rationale: "Nothing to rewrite yet." };
  if (input.action === "shorter") {
    const words = t.split(/\s+/);
    const target = Math.max(3, Math.round(words.length * 0.6));
    const cut = words.slice(0, target).join(" ").replace(/[,;:.\s]+$/, "");
    return { proposed: cleanProposed(cut, input.maxChars), rationale: "Trimmed to roughly 60% of the original (heuristic — set an Anthropic key for real rewrites)." };
  }
  if (input.action === "punchier") {
    const cleaned = t.replace(/\b(very|really|just|actually|truly|simply|literally)\b\s*/gi, "").replace(/\s{2,}/g, " ").trim();
    return { proposed: cleanProposed(cleaned, input.maxChars), rationale: "Stripped hedge words (heuristic — set an Anthropic key for real rewrites)." };
  }
  return { proposed: t, rationale: "Voice match needs Claude — leaving the line unchanged for now." };
}

function cleanProposed(s: string, max?: number): string {
  let out = s.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "").trim();
  if (max && out.length > max) out = out.slice(0, max).trimEnd();
  return out;
}
