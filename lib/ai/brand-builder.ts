import type { BrandTokens } from "@/lib/types";
import { PALETTES, paletteForIndustry } from "./palettes";
import { VOICES, voiceForIndustry } from "./voice";
import { FONTS, fontPairForMood } from "./fonts";
import { hashStr, pick, rng } from "./rand";

const IMAGERY_STYLES = [
  "editorial",
  "minimalist",
  "vibrant",
  "moody",
  "premium",
  "playful",
  "industrial",
  "natural",
] as const;

const TREATMENTS: Record<string, string> = {
  editorial: "Soft natural light, shallow depth of field, neutral color grade with a faint warm cast. Composition leans rule-of-thirds with generous negative space.",
  minimalist: "Flat product-on-color compositions. One light, hard shadow at 5° off-axis. No props. Surface is paper or stone.",
  vibrant: "High-saturation studio light with tropical color blocking. Confident shadows. Subjects feel sun-soaked and a touch graphic.",
  moody: "Single warm key light, deep falloff. Subjects emerge from black. Color grade pulled toward amber and ink.",
  premium: "Tabletop set, motion-blurred steam or pour, brass and bone props, candle-warm key light. Reads like a Sunday magazine cover.",
  playful: "Pastel backdrops, bouncy compositions, soft shadows, a little chaos. People mid-motion, mid-laugh.",
  industrial: "Concrete, raw metal, sodium-lamp tone. Subjects are tools, hands, hardware. High contrast, slight grain.",
  natural: "Daylight only, organic textures, dust motes in the light. Foreground botanicals out of focus. Calm.",
};

function inferIndustry(brief: string): string {
  const t = brief.toLowerCase();
  const map: Array<[string, string]> = [
    ["coffee|cafe|espresso|roaster", "cafe"],
    ["kombucha|drink|beverage|soda|juice|tea|matcha", "beverage"],
    ["skin|skincare|beauty|serum|cosmetic|makeup", "beauty"],
    ["clothes|fashion|apparel|garment|denim", "fashion"],
    ["fintech|bank|invest|stock|crypto|finance", "fintech"],
    ["school|edtech|learn|tutor|course|university|degree|curriculum", "education"],
    ["saas|software|api|developer|devtool|platform", "saas"],
    ["wellness|supplement|vitamin|nutrition", "wellness"],
    ["hotel|hospitality|restaurant|bar|bistro", "hospitality"],
    ["furniture|home|ceramic|craft|maker", "ceramics"],
    ["game|gaming|esport", "gaming"],
    ["car|auto|automotive|EV", "automotive"],
    ["health|medical|clinic|patient", "healthcare"],
    ["luxury|spirits|whisky|champagne", "luxury"],
  ];
  for (const [pat, name] of map) {
    if (new RegExp(pat).test(t)) return name;
  }
  return "lifestyle";
}

function inferMood(brief: string, industry: string): string {
  const t = brief.toLowerCase();
  const cues: Array<[string, string]> = [
    ["calm|quiet|grounded|considered|premium|crafted", "premium"],
    ["bold|loud|big|disrupt|punchy|fearless", "bold"],
    ["fun|playful|silly|joyful|kids|family", "playful"],
    ["clean|minimal|simple|focused|honest", "minimalist"],
    ["natural|organic|botanical|earth|garden", "natural"],
    ["dark|moody|night|sultry|smoky", "moody"],
    ["fast|modern|tech|edge|future|cyber", "tech"],
    ["warm|cozy|home|hand|maker|artisan", "warm"],
  ];
  for (const [pat, mood] of cues) {
    if (new RegExp(pat).test(t)) return mood;
  }
  const moodByIndustry: Record<string, string> = {
    cafe: "warm", beverage: "vibrant", beauty: "premium", fashion: "moody",
    fintech: "clean", saas: "clean", wellness: "natural", hospitality: "warm",
    ceramics: "warm", gaming: "tech", automotive: "moody", healthcare: "clean",
    education: "clean", luxury: "premium", lifestyle: "editorial",
  };
  return moodByIndustry[industry] || "editorial";
}

function nameFromBrief(brief: string): string {
  const m = brief.match(/([A-Z][A-Za-z&'\-]+(?:\s+[A-Z][A-Za-z&'\-]+)*)/);
  if (m) return m[1];
  return brief.split(/\s+/).slice(0, 2).join(" ").replace(/[^A-Za-z ]+/g, "") || "Untitled";
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export interface BrandSynth {
  name: string;
  slug: string;
  tagline: string;
  industry: string;
  description: string;
  tokens: BrandTokens;
}

export function synthesizeBrand(brief: string, overrides?: { name?: string; slug?: string }): BrandSynth {
  const seed = hashStr(brief + (overrides?.name || ""));
  const r = rng(seed);

  const industry = inferIndustry(brief);
  const mood = inferMood(brief, industry);
  const palette = paletteForIndustry(industry, mood);
  const voice = voiceForIndustry(industry);
  const fonts = fontPairForMood(mood);

  const stylePool = IMAGERY_STYLES.filter((s) =>
    palette.mood.includes(s) || voice.tone.includes(s) || s === mood,
  );
  const imageryStyle = (stylePool.length ? pick(stylePool, r) : pick(IMAGERY_STYLES, r)) as
    typeof IMAGERY_STYLES[number];

  const name = overrides?.name || nameFromBrief(brief);
  const slug = overrides?.slug || slugify(name);

  const tagline = synthesizeTagline(brief, name, industry, r);
  const description = synthesizeDescription(brief, name, industry, voice.name);

  const tokens: BrandTokens = {
    name,
    semver: "1.0.0",
    palette: {
      background: palette.background,
      surface: palette.surface,
      foreground: palette.foreground,
      primary: palette.primary,
      secondary: palette.secondary,
      accent: palette.accent,
      muted: palette.muted,
    },
    fonts: { display: fonts.display, body: fonts.body, mono: undefined },
    type: {
      eyebrowSize: 18,
      headlineSize: 96,
      subheadSize: 28,
      ctaSize: 20,
      lockerSize: 16,
      tracking: -0.02,
    },
    scrim: {
      topOpacity: 0.0,
      midOpacity: 0.12,
      bottomOpacity: imageryStyle === "moody" ? 0.7 : 0.5,
      coverage: 0.62,
      tint: palette.foreground === "#F5F2EA" || palette.foreground.startsWith("#F") ? "#000000" : "#000000",
    },
    voice: { description: voice.description, doNot: voice.doNot, tone: voice.tone },
    locker: { wordmark: name.toUpperCase(), locationLine: "" },
    imagery: {
      style: imageryStyle,
      treatment: TREATMENTS[imageryStyle],
      keywords: dedupe([
        industry,
        mood,
        ...voice.tone.slice(0, 2),
        ...palette.mood.slice(0, 2),
      ]),
    },
  };

  return { name, slug, tagline, industry, description, tokens };
}

// Industry-appropriate tagline banks for the deterministic (mock) path, so an
// edtech brand never gets a coffee tagline. The Claude path writes a real one.
const TAGLINES_BY_INDUSTRY: Record<string, string[]> = {
  education: ["Learn without limits.", "Skills that move you forward.", "Built for the curious.", "Your next step, well taught."],
  saas: ["Less busywork. More work.", "The tool that gets out of the way.", "Built for teams that ship.", "Clarity, by default."],
  fintech: ["Money, made clear.", "Confidence with every move.", "Your money, working smarter.", "Built on trust."],
  beauty: ["Skin, considered.", "Less, but better.", "Care that shows.", "The honest glow."],
  beverage: ["Bright by the sip.", "Made by feel, low on sugar.", "Refreshment, reconsidered.", "Taste the difference."],
  cafe: ["Brewed for the quiet hours.", "Built for the second cup.", "Small batches. Long memory.", "Made by hand."],
  fashion: ["Wear it your way.", "Quietly confident.", "Built to last, made to move.", "Style without the noise."],
  wellness: ["Feel like yourself again.", "Small habits, real change.", "Care you can keep.", "Well, simply."],
  hospitality: ["Stay a little longer.", "Made for the in-between.", "Where the evening slows.", "Come as you are."],
  ceramics: ["Made by hand. Built to keep.", "The everyday, elevated.", "Form you'll reach for.", "Quietly made."],
  gaming: ["Game on your terms.", "Built for the win.", "Play without limits.", "Made for the moment."],
  automotive: ["Engineered to move you.", "The drive, refined.", "Built for the road ahead.", "Performance, honestly."],
  healthcare: ["Care, made clear.", "Health you can trust.", "Better, together.", "Your wellbeing, first."],
  luxury: ["Quietly exceptional.", "Crafted to endure.", "The art of less.", "Made for the few."],
  lifestyle: ["For the way you actually live.", "Made with intent.", "Not louder. Better.", "An honest upgrade."],
};

function synthesizeTagline(brief: string, name: string, industry: string, r: () => number): string {
  const bank = TAGLINES_BY_INDUSTRY[industry] || TAGLINES_BY_INDUSTRY.lifestyle;
  return pick(bank, r);
}

function synthesizeDescription(brief: string, name: string, industry: string, voice: string): string {
  return `${name} is a ${industry} brand operating in the ${voice.toLowerCase()} register. The system below was synthesized from the brief and is editable end-to-end — every token, every voice rule, every imagery treatment.`;
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
