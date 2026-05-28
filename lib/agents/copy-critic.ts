import type { Brand } from "@/lib/types";
import { agentSystem, claudeModel, claudeMaxTokens, extractToolUse, getClaude } from "./adapters/claude";

export type CopyLayer = "headline" | "subhead" | "cta" | "eyebrow";

export interface RowCopyInput {
  brand: Brand;
  copy: { headline: string; subhead: string; cta: string; eyebrow: string };
  rowName?: string;
}

export interface RowCopyReview {
  score: number;                            // 0..1, 1 = ships
  fix: string;                              // one short sentence
  suggestion?: { layer: CopyLayer; proposed: string } | null;
}

// Quick copy-only review of one row (#56). Reuses the same Claude infrastructure
// as the other agents — but stays focused on WORDS (the Vision QC critic owns
// visual review on the design itself). Heuristic fallback so the action works
// without a key. Visual approval still lives at the design level (#49).
export async function reviewRowCopy(input: RowCopyInput): Promise<RowCopyReview> {
  if (getClaude()) {
    try { return await reviewWithClaude(input); }
    catch (e: any) { console.warn("[copy-critic] Claude failed, falling back:", e?.message || e); }
  }
  return reviewHeuristic(input);
}

async function reviewWithClaude(input: RowCopyInput): Promise<RowCopyReview> {
  const client = getClaude()!;
  const tokens = (input.brand as any).tokens;
  const system = agentSystem(
    `You review ONE row of ad copy. Score 0–1 (1 = ships as-is, 0.5 = revise, <0.4 = rewrite). Call out the single most important thing to fix in one short sentence (no marketing language). If a single concrete edit on ONE layer would help most, emit it — same message, brand voice. Otherwise omit the suggestion.`,
    input.brand,
    (input.brand as any).language || tokens?.voice,
  );

  const userText = [
    input.rowName ? `Variation: "${input.rowName}".` : "",
    "Copy under review:",
    `  eyebrow: ${input.copy.eyebrow || "(empty)"}`,
    `  headline: ${input.copy.headline || "(empty)"}`,
    `  subhead: ${input.copy.subhead || "(empty)"}`,
    `  cta: ${input.copy.cta || "(empty)"}`,
    "",
    "Return score, one-sentence fix, and (if helpful) one concrete edit on a single layer.",
  ].filter(Boolean).join("\n");

  const resp = await client.messages.create({
    model: claudeModel(),
    max_tokens: Math.min(claudeMaxTokens(), 700),
    system,
    messages: [{ role: "user", content: userText }],
    tools: [{
      name: "emit_review",
      description: "Return a copy review for this row.",
      input_schema: {
        type: "object",
        properties: {
          score: { type: "number", description: "0..1. 1 = ships, 0.5 = revise." },
          fix: { type: "string", description: "One short sentence on what to fix. No quotes." },
          suggestionLayer: { type: "string", enum: ["headline", "subhead", "cta", "eyebrow"] },
          suggestionText: { type: "string", description: "Concrete rewrite of that one layer. Same message, brand voice." },
        },
        required: ["score", "fix"],
      },
    }],
    tool_choice: { type: "tool", name: "emit_review" },
  });

  const out = extractToolUse<{ score: number; fix: string; suggestionLayer?: CopyLayer; suggestionText?: string }>(resp, "emit_review");
  const score = clamp01(out.score);
  const suggestion = out.suggestionLayer && out.suggestionText
    ? { layer: out.suggestionLayer, proposed: cleanText(out.suggestionText) }
    : null;
  return { score, fix: (out.fix || "").trim(), suggestion };
}

function reviewHeuristic(input: RowCopyInput): RowCopyReview {
  const { headline, subhead, cta } = input.copy;
  let score = 0.7;
  let fix = "Looks fine — set an Anthropic key for a real review.";
  let suggestion: RowCopyReview["suggestion"] = null;

  if (!headline.trim()) {
    score = 0.2; fix = "No headline yet — write the one thing this variation says.";
  } else if (headline.length > 80) {
    score = 0.5; fix = "Headline runs long for a feed read.";
    suggestion = { layer: "headline", proposed: headline.slice(0, 60).replace(/[\s,;:.]+$/, "") };
  } else if (!cta.trim()) {
    score = 0.55; fix = "Missing a CTA — close the loop on the click.";
  } else if (!subhead.trim()) {
    score = 0.65; fix = "Add a subhead to carry the promise.";
  }
  return { score, fix, suggestion };
}

function clamp01(n: number): number { return Math.max(0, Math.min(1, Number(n) || 0)); }
function cleanText(s: string): string { return s.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, "").trim(); }
