import { getClaude, claudeModel, claudeMaxTokens, extractToolUse } from "@/lib/agents/adapters/claude";
import { CopySchema, parseSchemaFromDoc, classifyLabel, type CopySchema as CopySchemaT } from "@/lib/copy-schema";

function slug(label: string): string {
  return (label || "field").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || "field";
}

// Infer a brand's copy schema from its copy doc. Real Claude when a key is
// present; otherwise a heuristic parse of labelled lines (works well on the
// clearly-organized docs teams already keep).
export async function inferCopySchema(docText: string, brandName?: string): Promise<{ schema: CopySchemaT; rationale: string; provider: "claude" | "heuristic" }> {
  const client = getClaude();
  if (!client) {
    return { schema: parseSchemaFromDoc(docText), rationale: "Parsed labelled fields from the doc (no Claude key — heuristic).", provider: "heuristic" };
  }
  try {
    const resp = await client.messages.create({
      model: claudeModel(),
      max_tokens: claudeMaxTokens(),
      system: `You read a brand's copy document and extract its COPY SCHEMA — the distinct labelled copy fields the team uses (e.g. headline, subhead, CTA, eyebrow, regional offer, on-image copy, emailer subject/body, heading) and any regions they localize for. Return via emit_schema. Per column: key (snake_case), label, role (one of headline|subhead|cta|eyebrow|offer|body|image|url|custom), layer (which on-creative slot it feeds: headline|subhead|cta|eyebrow, or none), maxChars for short fields, perRegion=true if localized, and one short example pulled from the doc. Prefer the team's own labels. If the doc localizes by region, list those regions.`,
      messages: [{ role: "user", content: `Brand: ${brandName || "—"}\n\nDocument:\n${docText.slice(0, 16000)}` }],
      tools: [{
        name: "emit_schema",
        description: "Return the brand's copy schema.",
        input_schema: {
          type: "object",
          properties: {
            rationale: { type: "string" },
            regions: { type: "array", items: { type: "string" } },
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  role: { type: "string", enum: ["headline", "subhead", "cta", "eyebrow", "offer", "body", "image", "url", "custom"] },
                  layer: { type: "string", enum: ["headline", "subhead", "cta", "eyebrow", "none"] },
                  maxChars: { type: "number" },
                  perRegion: { type: "boolean" },
                  example: { type: "string" },
                },
                required: ["label", "role"],
              },
            },
          },
          required: ["columns"],
        },
      }],
      tool_choice: { type: "tool", name: "emit_schema" },
    });
    const out = extractToolUse<{ columns: any[]; regions?: string[]; rationale?: string }>(resp, "emit_schema");
    const used = new Set<string>();
    const columns = (out.columns || []).map((c) => {
      const fallback = classifyLabel(c.label || "");
      let key = c.key || slug(c.label || "field");
      while (used.has(key)) key = `${key}_2`;
      used.add(key);
      return {
        key, label: c.label || key,
        role: c.role || fallback.role,
        layer: c.layer || fallback.layer,
        maxChars: c.maxChars ?? fallback.maxChars,
        perRegion: !!c.perRegion,
        example: c.example,
      };
    });
    const schema = CopySchema.parse({ columns, regions: out.regions || [] });
    return {
      schema: schema.columns.length ? schema : parseSchemaFromDoc(docText),
      rationale: out.rationale || "Inferred the brand's copy fields from the doc.",
      provider: "claude",
    };
  } catch (e: any) {
    console.warn("[copy-schema] Claude failed, heuristic fallback:", e?.message || e);
    return { schema: parseSchemaFromDoc(docText), rationale: "Claude unavailable; parsed labelled fields heuristically.", provider: "heuristic" };
  }
}
