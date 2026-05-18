import type { BrandTokens } from "@/lib/types";
import { claudeMaxTokens, claudeModel, extractToolUse, getClaude } from "./adapters/claude";

export interface TokenExtractionResult {
  rationale: string;
  tokens: BrandTokens;
}

const TOKEN_TOOL = {
  name: "emit_tokens",
  description: "Return a complete BrandTokens object inferred from the uploaded design.",
  input_schema: {
    type: "object",
    properties: {
      rationale: { type: "string", description: "One paragraph: what you saw in the design and how you mapped it to tokens." },
      tokens: {
        type: "object",
        properties: {
          name: { type: "string" },
          semver: { type: "string" },
          palette: {
            type: "object",
            properties: {
              background: { type: "string" },
              surface: { type: "string" },
              foreground: { type: "string" },
              primary: { type: "string" },
              secondary: { type: "string" },
              accent: { type: "string" },
              muted: { type: "string" },
            },
            required: ["background", "surface", "foreground", "primary", "secondary", "accent", "muted"],
          },
          fonts: {
            type: "object",
            properties: { display: { type: "string" }, body: { type: "string" } },
            required: ["display", "body"],
          },
          type: {
            type: "object",
            properties: {
              eyebrowSize: { type: "number" },
              headlineSize: { type: "number" },
              subheadSize: { type: "number" },
              ctaSize: { type: "number" },
              lockerSize: { type: "number" },
              tracking: { type: "number" },
            },
            required: ["eyebrowSize", "headlineSize", "subheadSize", "ctaSize", "lockerSize", "tracking"],
          },
          scrim: {
            type: "object",
            properties: {
              topOpacity: { type: "number" },
              midOpacity: { type: "number" },
              bottomOpacity: { type: "number" },
              coverage: { type: "number" },
              tint: { type: "string" },
            },
            required: ["topOpacity", "midOpacity", "bottomOpacity", "coverage", "tint"],
          },
          voice: {
            type: "object",
            properties: {
              description: { type: "string" },
              doNot: { type: "array", items: { type: "string" } },
              tone: { type: "array", items: { type: "string" } },
            },
            required: ["description", "doNot", "tone"],
          },
          locker: {
            type: "object",
            properties: { wordmark: { type: "string" }, locationLine: { type: "string" } },
            required: ["wordmark"],
          },
          imagery: {
            type: "object",
            properties: {
              style: { type: "string", enum: ["editorial", "minimalist", "vibrant", "moody", "premium", "playful", "industrial", "natural"] },
              treatment: { type: "string" },
              keywords: { type: "array", items: { type: "string" } },
            },
            required: ["style", "treatment", "keywords"],
          },
        },
        required: ["name", "semver", "palette", "fonts", "type", "scrim", "voice", "locker", "imagery"],
      },
    },
    required: ["rationale", "tokens"],
  },
} as const;

export async function extractTokensFromImage(input: {
  imageBytes: Buffer;
  mime: string;
  brandHintName?: string;
  brandHintIndustry?: string;
}): Promise<TokenExtractionResult> {
  const client = getClaude();
  if (!client) throw new Error("ANTHROPIC_API_KEY not set — token extraction needs Claude vision.");

  const system = `You are a brand systems designer. Look at the uploaded finished ad. Extract a complete BrandTokens object:\n- Palette: name 7 colors by their semantic role (background, surface, foreground, primary, secondary, accent, muted). Use hex codes you actually see.\n- Type: infer family fallback CSS stacks (e.g., "GT Sectra, Tiempos, Georgia, serif") and a typography scale.\n- Scrim: estimate the gradient overlay used to lift text off the photo (top/mid/bottom opacity, coverage, tint).\n- Voice: infer a voice description and three tone tags from the copy register.\n- Imagery: pick a style keyword and write a one-sentence treatment matching the photographic quality.\n- Locker: extract the wordmark and any location/tagline line.\nReturn ONLY via the emit_tokens tool.`;

  const resp = await client.messages.create({
    model: claudeModel(),
    max_tokens: claudeMaxTokens(),
    system,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: input.mime as any, data: input.imageBytes.toString("base64") } },
        {
          type: "text",
          text: [
            input.brandHintName ? `Brand name hint: ${input.brandHintName}` : "",
            input.brandHintIndustry ? `Industry hint: ${input.brandHintIndustry}` : "",
            `Extract the full token system from this single image. If a value isn't visible, infer a sensible default that matches the rest of the system. Use semver "1.0.0".`,
          ].filter(Boolean).join("\n"),
        },
      ],
    }],
    tools: [TOKEN_TOOL as any],
    tool_choice: { type: "tool", name: "emit_tokens" },
  });

  return extractToolUse<TokenExtractionResult>(resp, "emit_tokens");
}
