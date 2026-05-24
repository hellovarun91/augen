import type { Brand, BrandTokens } from "@/lib/types";
import { BrandTokens as BrandTokensSchema } from "@/lib/types";
import { getClaude, claudeModel, claudeMaxTokens, extractToolUse } from "@/lib/agents/adapters/claude";

export interface RefineResult {
  tokens: BrandTokens;
  summary: string;
  viaAI: boolean;
}

// ---------- color helpers (hex <-> hsl) for the heuristic fallback ----------
function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}
function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function adjust(hex: string, fn: (h: number, s: number, l: number) => [number, number, number]): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [h, s, l] = rgbToHsl(...rgb);
  return hslToHex(...fn(h, s, l));
}

// Heuristic refiner — recognizes common intents and nudges the system. Honest:
// it reports exactly what it changed, and says when it found nothing to act on.
function heuristicRefine(brand: Brand, instruction: string): RefineResult {
  const t = JSON.parse(JSON.stringify(brand.tokens)) as BrandTokens;
  const lc = instruction.toLowerCase();
  const did: string[] = [];
  const brandColors: (keyof BrandTokens["palette"])[] = ["primary", "secondary", "accent"];
  const neutrals: (keyof BrandTokens["palette"])[] = ["background", "surface", "foreground", "muted"];

  const has = (...words: string[]) => words.some((w) => lc.includes(w));

  if (has("warm", "warmer", "cozy", "earthy")) {
    brandColors.forEach((k) => { t.palette[k] = adjust(t.palette[k], (h, s, l) => [h > 180 ? h - 30 : Math.max(15, h - 12), Math.min(100, s + 4), l]); });
    did.push("warmed the brand colors");
  }
  if (has("cool", "cooler", "icy")) {
    brandColors.forEach((k) => { t.palette[k] = adjust(t.palette[k], (h, s, l) => [h < 180 ? h + 30 : Math.min(250, h + 12), s, l]); });
    did.push("cooled the brand colors");
  }
  if (has("darker", "deeper", "moodier", "moody")) {
    neutrals.forEach((k) => { t.palette[k] = adjust(t.palette[k], (h, s, l) => [h, s, Math.max(4, l - 10)]); });
    if (has("moodier", "moody")) { t.scrim.bottomOpacity = Math.min(0.85, t.scrim.bottomOpacity + 0.15); did.push("deepened the scrim"); }
    did.push("darkened the surfaces");
  }
  if (has("lighter", "brighter", "airier", "airy")) {
    neutrals.forEach((k) => { t.palette[k] = adjust(t.palette[k], (h, s, l) => [h, s, Math.min(97, l + 10)]); });
    did.push("lightened the surfaces");
  }
  if (has("vivid", "saturated", "punchy", "bolder color", "vibrant")) {
    brandColors.forEach((k) => { t.palette[k] = adjust(t.palette[k], (h, s, l) => [h, Math.min(100, s + 14), l]); });
    did.push("boosted color saturation");
  }
  if (has("muted color", "desaturate", "subtle color", "calmer color")) {
    brandColors.forEach((k) => { t.palette[k] = adjust(t.palette[k], (h, s, l) => [h, Math.max(0, s - 14), l]); });
    did.push("muted the colors");
  }

  // Voice tone adjustments
  const addTone = (...words: string[]) => {
    for (const w of words) if (!t.voice.tone.map((x) => x.toLowerCase()).includes(w)) t.voice.tone.push(w);
  };
  const toneEdits: [string[], string[], string][] = [
    [["bold", "bolder", "confident", "assertive"], ["bold", "confident"], "made the voice bolder"],
    [["playful", "fun", "lighter tone", "witty"], ["playful"], "added playfulness"],
    [["serious", "formal", "buttoned"], ["considered"], "made the voice more considered"],
    [["minimal", "restrained", "understated", "spare"], ["restrained"], "made the voice more restrained"],
    [["premium", "luxury", "elevated", "upscale"], ["premium"], "raised the register to premium"],
    [["warm voice", "friendly", "human", "approachable"], ["warm"], "made the voice warmer"],
    [["calm", "gentle", "soft tone", "quiet"], ["calm"], "softened the voice"],
  ];
  for (const [triggers, tones, msg] of toneEdits) {
    if (has(...triggers)) { addTone(...tones); did.push(msg); }
  }
  t.voice.tone = t.voice.tone.slice(0, 6);

  const summary = did.length
    ? `Heuristic refine: ${did.join(", ")}.`
    : "No clear change found. Try words like “warmer”, “darker”, “bolder”, “more minimal”, or connect a live AI key for free-form edits.";
  return { tokens: BrandTokensSchema.parse(t), summary, viaAI: false };
}

// Free-form refine: Claude reads the current system + instruction and proposes a
// revised token set. Falls back to the heuristic refiner with no key / on error.
export async function refineBrandAI(brand: Brand, instruction: string): Promise<RefineResult> {
  const client = getClaude();
  if (!client) return heuristicRefine(brand, instruction);
  const cur = brand.tokens;
  try {
    const resp = await client.messages.create({
      model: claudeModel(),
      max_tokens: claudeMaxTokens(),
      system: `You refine an existing brand's design tokens. Apply the user's instruction precisely and conservatively — change only what the instruction implies, keep everything else identical. Return the FULL revised palette, fonts, voice, and imagery via emit_refined. Hex values must be valid 6-digit hex. Stay true to the brand; never make it generic or hypey.`,
      messages: [{
        role: "user",
        content: `Current tokens:\n${JSON.stringify({ palette: cur.palette, fonts: cur.fonts, voice: cur.voice, imagery: cur.imagery }, null, 2)}\n\nInstruction: ${instruction}`,
      }],
      tools: [{
        name: "emit_refined",
        description: "Return the revised brand tokens after applying the instruction.",
        input_schema: {
          type: "object",
          properties: {
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
            imagery: { type: "object", properties: { style: { type: "string" }, treatment: { type: "string" }, keywords: { type: "array", items: { type: "string" } } }, required: ["style", "treatment", "keywords"] },
            summary: { type: "string", description: "One sentence describing what changed." },
          },
          required: ["palette", "fonts", "voice", "imagery", "summary"],
        },
      }],
      tool_choice: { type: "tool", name: "emit_refined" },
    });
    const out = extractToolUse<any>(resp, "emit_refined");
    if (!out?.palette) return heuristicRefine(brand, instruction);
    const tokens = BrandTokensSchema.parse({
      ...cur,
      palette: out.palette,
      fonts: { ...cur.fonts, display: out.fonts?.display || cur.fonts.display, body: out.fonts?.body || cur.fonts.body },
      voice: { description: out.voice?.description ?? cur.voice.description, tone: out.voice?.tone ?? cur.voice.tone, doNot: out.voice?.doNot ?? cur.voice.doNot },
      imagery: { ...cur.imagery, style: out.imagery?.style || cur.imagery.style, treatment: out.imagery?.treatment ?? cur.imagery.treatment, keywords: out.imagery?.keywords || cur.imagery.keywords },
    });
    return { tokens, summary: out.summary || "Refined with AI.", viaAI: true };
  } catch {
    return heuristicRefine(brand, instruction);
  }
}
