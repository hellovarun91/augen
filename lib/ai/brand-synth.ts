import { BrandTokens as BrandTokensSchema } from "@/lib/types";
import { getClaude, claudeModel, claudeMaxTokens, extractToolUse } from "@/lib/agents/adapters/claude";
import { synthesizeBrand, type BrandSynth } from "./brand-builder";
import { slugify } from "@/lib/utils";

const IMAGERY_STYLES = ["editorial", "minimalist", "vibrant", "moody", "premium", "playful", "industrial", "natural"];

// Assemble a validated BrandSynth from Claude's emitted fields, filling type /
// scrim / locker with sensible defaults the model doesn't need to choose.
function assemble(out: any, overrides?: { name?: string; slug?: string }): BrandSynth {
  const name = (overrides?.name || out.name || "Untitled").trim();
  const slug = overrides?.slug || slugify(name);
  const tokens = BrandTokensSchema.parse({
    name, semver: "1.0.0",
    palette: out.palette,
    fonts: { display: out.fonts?.display, body: out.fonts?.body },
    type: { eyebrowSize: 18, headlineSize: 96, subheadSize: 28, ctaSize: 20, lockerSize: 16, tracking: -0.02 },
    scrim: { topOpacity: 0, midOpacity: 0.12, bottomOpacity: out.imagery?.style === "moody" ? 0.7 : 0.5, coverage: 0.62, tint: "#000000" },
    voice: { description: out.voice?.description || "", doNot: out.voice?.doNot || [], tone: out.voice?.tone || [] },
    locker: { wordmark: name.toUpperCase(), locationLine: "" },
    imagery: { style: out.imagery?.style || "editorial", treatment: out.imagery?.treatment || "", keywords: out.imagery?.keywords || [] },
  });
  return { name, slug, tagline: out.tagline || "", industry: out.industry || "lifestyle", description: out.description || "", tokens };
}

// Real AI brand synthesis — Claude reads the brief and writes an accurate,
// brand-specific foundation. Falls back to the deterministic builder (now with
// industry-appropriate taglines) when no key, or if Claude errors/returns junk.
export async function synthesizeBrandAI(brief: string, overrides?: { name?: string; slug?: string }): Promise<BrandSynth> {
  const client = getClaude();
  if (!client) return synthesizeBrand(brief, overrides);
  try {
    const resp = await client.messages.create({
      model: claudeModel(),
      max_tokens: claudeMaxTokens(),
      system: `You are a brand systems designer. From a short brief, synthesize a complete, accurate, brand-specific identity via emit_brand. Be true to THIS brand: the correct industry, a real tagline written for it (never a template or coffee-shop cliché unless it's actually a cafe), a palette whose hex values genuinely fit the brand's feel, font-stack intent, a voice (description + tone words + things it must never do), and an imagery style + treatment. Restrained and editorial, not hypey.`,
      messages: [{ role: "user", content: `Brief:\n${brief}${overrides?.name ? `\n\nUse this brand name: ${overrides.name}` : ""}` }],
      tools: [{
        name: "emit_brand",
        description: "Return the synthesized brand identity.",
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            tagline: { type: "string" },
            industry: { type: "string" },
            description: { type: "string" },
            palette: {
              type: "object",
              properties: {
                background: { type: "string" }, surface: { type: "string" }, foreground: { type: "string" },
                primary: { type: "string" }, secondary: { type: "string" }, accent: { type: "string" }, muted: { type: "string" },
              },
              required: ["background", "surface", "foreground", "primary", "secondary", "accent", "muted"],
            },
            fonts: { type: "object", properties: { display: { type: "string" }, body: { type: "string" } }, required: ["display", "body"] },
            voice: {
              type: "object",
              properties: { description: { type: "string" }, tone: { type: "array", items: { type: "string" } }, doNot: { type: "array", items: { type: "string" } } },
              required: ["description", "tone", "doNot"],
            },
            imagery: {
              type: "object",
              properties: { style: { type: "string", enum: IMAGERY_STYLES }, treatment: { type: "string" }, keywords: { type: "array", items: { type: "string" } } },
              required: ["style", "treatment", "keywords"],
            },
          },
          required: ["name", "tagline", "industry", "description", "palette", "fonts", "voice", "imagery"],
        },
      }],
      tool_choice: { type: "tool", name: "emit_brand" },
    });
    return assemble(extractToolUse<any>(resp, "emit_brand"), overrides);
  } catch (e: any) {
    console.warn("[brand-synth] Claude failed, deterministic fallback:", e?.message || e);
    return synthesizeBrand(brief, overrides);
  }
}
