import type { Brand } from "@/lib/types";
import { agentSystem, claudeMaxTokens, claudeModel, extractToolUse, extractUsage, getClaude } from "./adapters/claude";
import { collectReviewerNotes } from "@/lib/repo";

export interface RuleProposal {
  kind: "do" | "dont" | "preferred" | "banned";
  rule: string;
  evidence: string;
}

export async function refineRulesFromReviews(brand: Brand): Promise<{ proposals: RuleProposal[]; rationale: string; usage?: any; provider: string }> {
  const notes = collectReviewerNotes(brand.id, 60);
  if (notes.length === 0) return { proposals: [], rationale: "No reviewer notes yet — nothing to cluster.", provider: "n/a" };

  const client = getClaude();
  if (!client) {
    // Heuristic fallback: dedupe short notes as candidate Do/Don't lines.
    const seen = new Set<string>();
    const props: RuleProposal[] = [];
    for (const n of notes) {
      const t = n.note.trim();
      if (t.length < 6 || t.length > 90 || seen.has(t)) continue;
      seen.add(t);
      const isNeg = /\b(too|don't|avoid|drop|too long|too short|too precious|generic|cliché|cliche|over)\b/i.test(t);
      props.push({ kind: isNeg ? "dont" : "do", rule: t, evidence: `Heuristic — drawn from reviewer note on "${n.headline.slice(0, 40)}"` });
      if (props.length >= 6) break;
    }
    return { proposals: props, rationale: "Heuristic clustering (no Claude key).", provider: "mock" };
  }

  const system = agentSystem(
    `You are a brand systems editor. Look at the reviewer notes left on rejected or revision-flagged ads for this brand. Cluster recurring themes into a small set of concrete, ad-ready rules.\n\nReturn 3-7 proposals via the emit_rules tool. Each rule must be specific (not "be better"), short (one sentence), and ad-ready. Use kind="dont" for prohibitions, "do" for affirmative behaviors, "banned" for single words/phrases to avoid, "preferred" for words to promote.\n\nIf the notes are noisy or contradictory, prefer fewer high-confidence rules over many.`,
    brand,
    brand.language,
  );

  const userText = [
    "Reviewer notes (most recent first):",
    ...notes.slice(0, 60).map((n, i) =>
      `${i + 1}. [${n.verdict}] on ${n.format_slug} for "${n.headline.replace(/\n/g, " ").slice(0, 60)}" — ${n.note}`,
    ),
  ].join("\n");

  const resp = await client.messages.create({
    model: claudeModel(),
    max_tokens: claudeMaxTokens(),
    system,
    messages: [{ role: "user", content: userText }],
    tools: [{
      name: "emit_rules",
      description: "Return proposed brand rules clustered from reviewer notes.",
      input_schema: {
        type: "object",
        properties: {
          rationale: { type: "string" },
          proposals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["do", "dont", "preferred", "banned"] },
                rule: { type: "string" },
                evidence: { type: "string", description: "Short note referencing which reviewer notes support this." },
              },
              required: ["kind", "rule", "evidence"],
            },
          },
        },
        required: ["rationale", "proposals"],
      },
    } as any],
    tool_choice: { type: "tool", name: "emit_rules" },
  });

  const out = extractToolUse<{ rationale: string; proposals: RuleProposal[] }>(resp, "emit_rules");
  return { proposals: out.proposals, rationale: out.rationale, usage: extractUsage(resp), provider: "claude" };
}
