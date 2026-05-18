import type { ArtDirectorInput, ArtDirectorOutput } from "./types";
import { hashStr, pick, rng } from "@/lib/ai/rand";
import { brandSystemBlock, claudeMaxTokens, claudeModel, extractToolUse, extractUsage, getClaude } from "./adapters/claude";
import type { AgentUsage } from "./persistence";

const COMPOSITIONS = [
  "Rule-of-thirds, subject upper-left, generous negative space lower-right.",
  "Centered subject, symmetrical frame, dropped horizon for headline above.",
  "Subject in lower third, sky-dominant frame, copy lives in clean upper area.",
  "Edge-aligned subject, almost cropping off-frame, asymmetric tension.",
  "Macro close-up, single in-focus plane, surrounding ambient blur.",
  "Stacked verticals — three subjects at depth, lit individually.",
  "Wide environmental shot, subject small in frame, atmosphere does the work.",
];

const LIGHTING = [
  "Soft window light from camera-left, falloff to deep shadow on camera-right.",
  "Single tungsten key at 45° above subject, warm bounce from below, no fill.",
  "Open shade, even ambient daylight, neutral grade.",
  "Hard noon sun, geometric shadows, color blocked backdrop.",
  "Mixed practicals — sodium streetlight plus a warm interior pool.",
  "Candle key, slow shutter, frozen by a single off-camera flash on the subject.",
];

const SUBJECTS_BY_INDUSTRY: Record<string, string[]> = {
  cafe: ["A ceramic cup on a warm-toned table, steam rising slow.", "Hands cradling an espresso, dark thumbnail of foam visible.", "A pour-over mid-bloom, copper kettle blurred behind.", "A paper bag of beans torn open, oils visible on the bean's surface."],
  beverage: ["A frosted glass with condensation, citrus peel mid-air.", "A can cracked open, single droplet caught mid-fall.", "Pour into a tumbler, slow-motion, ice catching light.", "Bottles arranged like a still life, light gradient across labels."],
  beauty: ["A glass dropper above the back of a hand, single bead about to fall.", "Product on a cool stone, slick of texture beside it.", "A subject's neckline, light catching dewy skin, no makeup.", "Cap removed, foreground bokeh of botanicals."],
  fashion: ["Subject mid-step on a wide neutral floor, garment in motion.", "Crop of a sleeve and wrist, light kissing the seam.", "Three-quarter view, neutral wall, soft daylight.", "Subject reading by a window, garment in its working state."],
  fintech: ["A hand and a card mid-transaction, cool light on a steel surface.", "An open laptop, brand-tinted screen reflected on a clean desk.", "A phone face-up on a stone counter, app glow centered.", "A subject mid-conversation, finance is an unspoken detail."],
  saas: ["A laptop in environment, screen-glow tinted to brand, hands in soft motion.", "Two monitors at an angle, one with a calm interface, one with code.", "A meeting through a window, blurred figures, brand on a single tab.", "Hands and a notebook, the product is implied by what's not on the page."],
  wellness: ["Bottle on a stone tray with a single botanical stem.", "Subject in soft morning light, capsule on the tongue.", "A glass of water on a kitchen island, capsule beside it.", "Hands placing the bottle into a daily-use tray."],
  hospitality: ["A guest room at golden hour, sheets crumpled in the honest way.", "A pour at the bar, the room out of focus behind.", "A laid table seen from above, plates not yet served.", "A long corridor at dusk, one door open, warm interior beyond."],
  ceramics: ["A mug centered, hand-thrown ridges catching the key light.", "Studio shelf, three pieces, slight uneven set.", "Mug being lifted, steam rising, breakfast off-camera.", "A maker's hand finishing a rim, wheel blurred underneath."],
  gaming: ["A console controller half-lit, screen glow tinted brand on hands.", "Two players' silhouettes on a couch, screen out of focus.", "A keyboard close-up, mid-press, single keycap in focus.", "A headset on a desk, gradient of the brand color behind."],
  lifestyle: ["A subject mid-laugh at a doorway, soft light flooding in.", "A still life of three brand objects on a stone surface.", "An object in use — hand, garment, room — at golden hour.", "A breakfast scene mid-pour, atmosphere over object."],
};

export async function runArtDirector(input: ArtDirectorInput): Promise<{ output: ArtDirectorOutput; rationale: string; usage?: AgentUsage }> {
  if (getClaude()) {
    try { return await runArtDirectorClaude(input); }
    catch (e: any) { console.warn("[art_director] Claude failed, falling back to mock:", e?.message || e); }
  }
  return runArtDirectorMock(input);
}

async function runArtDirectorClaude(input: ArtDirectorInput): Promise<{ output: ArtDirectorOutput; rationale: string; usage: AgentUsage }> {
  const client = getClaude()!;
  const lang = (input.brand as any).language;
  const system = [
    {
      type: "text" as const,
      text: `You are a brand Art Director. You direct a photographic image generator. Pick composition, lighting, subject, and palette emphasis that feel native to this brand. The output is a single image prompt the generator will follow literally — write it as crisp, specific direction. No marketing language. Avoid logos and text in the image.`,
      cache_control: { type: "ephemeral" as const },
    },
    brandSystemBlock(input.brand, lang || (input.brand as any).tokens.voice),
  ];

  const userText = [
    `Idea theme: ${input.idea.theme}`,
    `Angle: ${input.idea.angle}`,
    (input.idea as any).insight ? `Insight: ${(input.idea as any).insight}` : "",
    input.product ? `Product focus: ${input.product}` : "",
    `Format: ${input.formatSlug} (aspect ${input.aspect})`,
    input.referencePool?.length ? `Brand reference pool: ${input.referencePool.slice(0, 8).join("; ")}. Condition for subject consistency.` : "No brand references uploaded yet — invent from the brand's imagery treatment.",
    input.notes ? `Operator notes: ${input.notes}` : "",
    "",
    "Direct one shot. Emit subject, composition, lighting, style keyword, palette emphasis (3-6 hex codes), and the full image prompt.",
  ].filter(Boolean).join("\n");

  const resp = await client.messages.create({
    model: claudeModel(),
    max_tokens: claudeMaxTokens(),
    system,
    messages: [{ role: "user", content: userText }],
    tools: [{
      name: "emit_direction",
      description: "Return art direction for this ad's image.",
      input_schema: {
        type: "object",
        properties: {
          rationale: { type: "string" },
          subject: { type: "string" },
          composition: { type: "string" },
          lighting: { type: "string" },
          styleKeyword: { type: "string" },
          paletteEmphasis: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
          imagePrompt: { type: "string", description: "The full prompt sent to the image generator. Include subject, composition, lighting, aspect ratio." },
          refSuggestion: { type: "string" },
        },
        required: ["rationale", "subject", "composition", "lighting", "styleKeyword", "paletteEmphasis", "imagePrompt"],
      },
    }],
    tool_choice: { type: "tool", name: "emit_direction" },
  });

  const out = extractToolUse<Omit<ArtDirectorOutput, "seed">>(resp, "emit_direction");
  const seed = hashStr(`${input.brand.slug}|${input.idea.theme}|${input.formatSlug}|${input.variantIndex}`);
  return { output: { ...out, seed }, rationale: out.rationale, usage: extractUsage(resp) };
}

async function runArtDirectorMock(input: ArtDirectorInput): Promise<{ output: ArtDirectorOutput; rationale: string }> {
  const seedBase = `${input.brand.slug}|${input.idea.theme}|${input.product || ""}|${input.formatSlug}|v${input.variantIndex}|${input.notes || ""}`;
  const seed = hashStr(seedBase);
  const r = rng(seed);

  const industry = (input.brand.industry || "lifestyle").toLowerCase();
  const subjects = SUBJECTS_BY_INDUSTRY[industry] || SUBJECTS_BY_INDUSTRY.lifestyle;
  const subject = pick(subjects, r);
  const composition = pick(COMPOSITIONS, r);
  const lighting = pick(LIGHTING, r);
  const style = input.brand.tokens.imagery.style;
  const treatment = input.brand.tokens.imagery.treatment;
  const palette = [
    input.brand.tokens.palette.background,
    input.brand.tokens.palette.surface,
    input.brand.tokens.palette.foreground,
    input.brand.tokens.palette.primary,
    input.brand.tokens.palette.secondary,
    input.brand.tokens.palette.accent,
  ];

  const refSuggestion = input.referencePool && input.referencePool.length > 0
    ? input.referencePool[Math.floor(r() * input.referencePool.length)]
    : undefined;

  const imagePrompt = [
    `Subject: ${subject}`,
    `Composition: ${composition}`,
    `Lighting: ${lighting}`,
    `Style: ${style}, ${treatment}`,
    `Palette emphasis: ${palette.slice(0, 3).join(", ")} with accents of ${palette[5]}.`,
    `Aspect ratio: ${input.aspect}.`,
    refSuggestion ? `Brand reference: condition on ${refSuggestion}.` : `Brand reference: ${input.brand.name}. Maintain subject consistency.`,
    `Avoid: text in image, logos in image, watermark, AI artifacting.`,
  ].join(" \n");

  const rationale = [
    `For ${input.idea.angle} on ${input.formatSlug}, I'm reaching for a ${style} treatment.`,
    `Composition: ${composition}.`,
    `Lighting: ${lighting}.`,
    `Subject reads cleanly even at the ${input.aspect} crop because the focal area is in the safe zone.`,
    refSuggestion ? `Conditioning on a brand reference (${refSuggestion}) to keep subject consistency across variants.` : `No brand reference uploaded yet — when one is in the library the next ad will inherit its grade.`,
  ].join(" ");

  return {
    output: {
      rationale,
      subject,
      composition,
      lighting,
      styleKeyword: style,
      paletteEmphasis: palette,
      imagePrompt,
      refSuggestion,
      seed,
    },
    rationale,
  };
}
