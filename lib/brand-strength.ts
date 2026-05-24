import type { Brand } from "./types";

export interface StrengthItem {
  id: string;
  label: string;
  done: boolean;
  weight: number;
  href: string;
  hint: string;
}

export interface FoundationStrength {
  score: number; // 0–100
  band: "thin" | "forming" | "solid" | "strong";
  items: StrengthItem[];
}

export interface StrengthSignals {
  assets: number;
  references: number;
  winners: number;
}

// A deterministic read on how complete a brand foundation is. No AI — it just
// inspects what's been filled in, so a creator can see at a glance what would
// make the system produce sharper work, with a deep link to each gap.
export function foundationStrength(brand: Brand, signals: StrengthSignals): FoundationStrength {
  const base = `/brands/${brand.slug}`;
  const v = brand.tokens.voice;
  const lang = brand.language;
  const sliders = lang.toneSliders;
  const slidersTuned = [sliders.formal_casual, sliders.serious_playful, sliders.reserved_bold, sliders.classic_modern].some((n) => n !== 0);
  const lexicon = (lang.preferredWords?.length || 0) + (lang.bannedWords?.length || 0);
  const exemplars = lang.exemplars;
  const hasExemplar = [exemplars.eyebrow, exemplars.headline, exemplars.subhead, exemplars.cta].some((a) => (a?.length || 0) > 0);
  const voiceDesc = (lang.voiceDescription || v.description || "").trim();

  const items: StrengthItem[] = [
    { id: "tagline", label: "Tagline", weight: 1, href: `${base}/identity`, hint: "A line that captures the promise.", done: !!brand.tagline?.trim() },
    { id: "description", label: "Brand description", weight: 1, href: `${base}/identity`, hint: "A sentence on what the brand is and who it's for.", done: (brand.description || "").trim().length >= 20 },
    { id: "voice-desc", label: "Voice description", weight: 2, href: `${base}/language`, hint: "Describe how the brand sounds — the copywriter reads this first.", done: voiceDesc.length >= 40 },
    { id: "tone-words", label: "Tone words", weight: 1, href: `${base}/language`, hint: "Two or more adjectives anchor the register.", done: (v.tone?.length || 0) >= 2 },
    { id: "tone-sliders", label: "Tone sliders tuned", weight: 1, href: `${base}/language`, hint: "Move the sliders off neutral so the voice has a point of view.", done: slidersTuned },
    { id: "do", label: "Do rules", weight: 1, href: `${base}/language`, hint: "Positive guidance sharpens copy more than bans alone.", done: (lang.doRules?.length || 0) >= 1 },
    { id: "donot", label: "Do-not rules", weight: 1, href: `${base}/language`, hint: "What the brand never says.", done: (lang.doNotRules?.length || 0) >= 1 },
    { id: "lexicon", label: "Preferred / banned words", weight: 1, href: `${base}/language`, hint: "A few word swaps keep the lexicon consistent.", done: lexicon >= 3 },
    { id: "samples", label: "Sample sentences", weight: 1, href: `${base}/language`, hint: "Real lines in the brand's voice the copywriter can imitate.", done: (lang.sampleSentences?.length || 0) >= 1 },
    { id: "exemplars", label: "Slot exemplars", weight: 1, href: `${base}/language`, hint: "Per-slot examples (headline, CTA…) raise copy fidelity.", done: hasExemplar },
    { id: "assets", label: "Brand assets", weight: 2, href: `${base}/assets`, hint: "A logo or mark Augen can composite into ads.", done: signals.assets >= 1 },
    { id: "references", label: "Reference imagery", weight: 1, href: `${base}/references`, hint: "Visual references steer the art direction.", done: signals.references >= 1 },
    { id: "winners", label: "Past winners", weight: 1, href: `${base}/winners`, hint: "Proven creatives the agents anchor to.", done: signals.winners >= 1 },
  ];

  const total = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
  const score = Math.round((earned / total) * 100);
  const band = score >= 85 ? "strong" : score >= 60 ? "solid" : score >= 35 ? "forming" : "thin";
  return { score, band, items };
}
