import type { Brand, BrandLanguage } from "@/lib/types";
import { formatBySlug } from "@/lib/formats";
import { agentSystem, claudeMaxTokens, claudeModel, extractToolUse, extractUsage, getClaude } from "./adapters/claude";
import type { AgentUsage } from "./persistence";

export interface VisionCritique {
  legibility: number;    // can every line be read at thumbnail + full size?
  contrast: number;      // text vs background separation
  composition: number;   // focal balance, negative space, hierarchy
  safeArea: number;      // nothing important clipped or jammed to an edge
  brandFit: number;      // does the rendered frame look like this brand?
  overallScore: number;  // 0–1 weighted design verdict
  verdict: "ship" | "revise" | "kill";
  notes: string[];       // what's working / what's wrong, specific
  fixes: string[];       // concrete, actionable changes (map to overrides where possible)
  viaVision: boolean;    // true if a real model looked at pixels; false = heuristic fallback
}

export interface VisionCriticInput {
  brand: Brand;
  language: BrandLanguage;
  formatSlug: string;
  copy: { eyebrow?: string; headline: string; subhead?: string; cta: string };
  png?: { bytes: Buffer; mime: string }; // the rendered composite
}

const ROLE = `You are a brand design QC reviewer. You are shown the FINAL rendered ad creative as an image. Judge what you actually see — not the copy in the abstract. Score five axes 0–1: legibility (can every line be read, including at small sizes), contrast (text vs the background behind it), composition (focal balance, hierarchy, use of negative space), safeArea (nothing important clipped or crammed against an edge), brandFit (does this frame look like this brand's system). Be strict: a creative with text over a busy area, low contrast, or a clipped headline should score low even if the copy is good. Return an overallScore, a ship/revise/kill verdict, 3-6 specific notes about what you see, and concrete fixes (e.g. "increase bottom scrim", "shift CTA to top-right", "shorten headline to 2 lines").`;

const VISION_PROPS = {
  legibility: { type: "number", minimum: 0, maximum: 1 },
  contrast: { type: "number", minimum: 0, maximum: 1 },
  composition: { type: "number", minimum: 0, maximum: 1 },
  safeArea: { type: "number", minimum: 0, maximum: 1 },
  brandFit: { type: "number", minimum: 0, maximum: 1 },
  overallScore: { type: "number", minimum: 0, maximum: 1 },
  verdict: { type: "string", enum: ["ship", "revise", "kill"] },
  notes: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
  fixes: { type: "array", items: { type: "string" }, maxItems: 6 },
} as const;

export async function runVisionCritic(input: VisionCriticInput): Promise<{ output: VisionCritique; rationale: string; usage?: AgentUsage }> {
  if (input.png && getClaude()) {
    try { return await runVisionClaude(input); }
    catch (e: any) { console.warn("[vision-critic] Claude vision failed, falling back to heuristic:", e?.message || e); }
  }
  return { ...heuristic(input) };
}

async function runVisionClaude(input: VisionCriticInput): Promise<{ output: VisionCritique; rationale: string; usage: AgentUsage }> {
  const client = getClaude()!;
  const fmt = formatBySlug(input.formatSlug);
  const system = agentSystem(ROLE, input.brand, input.language);
  const png = input.png!;

  const text = [
    `This is the rendered ad. Format: ${fmt ? `${fmt.name} (${fmt.width}×${fmt.height}, ${fmt.aspect})` : input.formatSlug}.`,
    `The intended copy is — eyebrow: "${input.copy.eyebrow || ""}", headline: "${input.copy.headline}", subhead: "${input.copy.subhead || ""}", CTA: "${input.copy.cta}".`,
    `Check the rendered frame against that copy: is any line clipped, overflowing, or unreadable? Then score and advise.`,
  ].join("\n");

  const resp = await client.messages.create({
    model: claudeModel(),
    max_tokens: claudeMaxTokens(),
    system,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: (png.mime as any) || "image/png", data: png.bytes.toString("base64") } },
        { type: "text", text },
      ],
    }],
    tools: [{
      name: "emit_visual_critique",
      description: "Return the design QC verdict on the rendered creative.",
      input_schema: { type: "object", properties: { ...VISION_PROPS, rationale: { type: "string" } }, required: ["legibility", "contrast", "composition", "safeArea", "brandFit", "overallScore", "verdict", "notes"] },
    }],
    tool_choice: { type: "tool", name: "emit_visual_critique" },
  });

  const out = extractToolUse<VisionCritique & { rationale?: string }>(resp, "emit_visual_critique");
  return {
    output: {
      legibility: out.legibility, contrast: out.contrast, composition: out.composition,
      safeArea: out.safeArea, brandFit: out.brandFit, overallScore: out.overallScore,
      verdict: out.verdict, notes: out.notes || [], fixes: out.fixes || [], viaVision: true,
    },
    rationale: out.rationale || `Visual QC scored ${(out.overallScore * 100).toFixed(0)}.`,
    usage: extractUsage(resp),
  };
}

// Heuristic fallback — no pixels, so it is honest about that and infers only what
// copy + format + scrim allow (overflow risk, contrast risk from a thin scrim).
function heuristic(input: VisionCriticInput): { output: VisionCritique; rationale: string } {
  const fmt = formatBySlug(input.formatSlug);
  const head = (input.copy.headline || "").replace(/\s+/g, " ").trim();
  const ratio = fmt ? fmt.width / fmt.height : 1;
  const notes: string[] = ["Heuristic estimate — connect a live AI key to score the actual rendered pixels."];
  const fixes: string[] = [];

  let legibility = 0.8, safeArea = 0.85;
  if (ratio >= 3 && head.length > 28) { legibility -= 0.2; safeArea -= 0.15; notes.push(`Headline is ${head.length} chars on a wide banner crop — likely to overflow or shrink below comfortable size.`); fixes.push("Shorten headline to ≤28 chars for this crop."); }
  else if (ratio <= 0.6 && head.split("\n").length > 4) { safeArea -= 0.12; notes.push("Headline runs long for a vertical crop — risk of crowding the safe area."); fixes.push("Trim to 2–3 stacked lines."); }

  // Contrast risk inferred from the scrim that sits behind the text.
  const scrim = input.brand.tokens.scrim;
  let contrast = 0.8;
  if ((scrim?.bottomOpacity ?? 0.5) < 0.35) { contrast -= 0.15; notes.push("Bottom scrim is light — text over a busy photo may not separate well."); fixes.push("Increase bottom scrim opacity."); }

  const composition = 0.78, brandFit = 0.82;
  const overallScore = clamp(legibility * 0.3 + contrast * 0.25 + composition * 0.2 + safeArea * 0.15 + brandFit * 0.1, 0, 1);
  const verdict: VisionCritique["verdict"] = overallScore >= 0.85 ? "ship" : overallScore >= 0.6 ? "revise" : "kill";
  return {
    output: { legibility, contrast, composition, safeArea, brandFit, overallScore, verdict, notes, fixes, viaVision: false },
    rationale: `Heuristic visual QC ≈ ${(overallScore * 100).toFixed(0)} (no pixels inspected).`,
  };
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
