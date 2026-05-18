import type { Brand, Idea } from "@/lib/types";
import { hashStr, pick, pickN, rng } from "./rand";
import { CTA_BANK } from "./planner";

export interface CopyVariant {
  eyebrow: string;
  headline: string;
  subhead: string;
  cta: string;
}

const HEADLINE_TEMPLATES = [
  "{product}.\nMade for the\nway you live.",
  "{product},\nrethought.",
  "A quieter\n{product}.",
  "The {product}\nyou'll keep.",
  "Begin with\n{product}.",
  "{product},\nwithout\nthe theater.",
  "{product}\nin its honest form.",
  "First,\n{product}.\nThen everything else.",
  "Slow goods.\nQuick yes.",
  "{product}\nfor the\nsecond cup.",
  "{theme}\nseason.",
  "{theme},\ncorrectly.",
  "Less talk.\nBetter {product}.",
  "Made small.\nMade well.",
  "The unfussy\n{product}.",
];

const SUBHEAD_TEMPLATES = [
  "Crafted with {ingredient}. Designed for {audience}.",
  "{benefit}. No theater, no compromise.",
  "Made in small batches. Built for daily use.",
  "A simple promise: {promise}.",
  "Now in {flavors}. Available where {brand} ships.",
  "For {audience} who'd rather not think about it.",
  "Designed to be the default — not the experiment.",
  "{ingredient}, finished by hand.",
  "Built once. Used daily. Replaced rarely.",
  "What we kept in: {benefit}. What we left out: everything else.",
  "Quietly correct, honestly priced.",
];

const EYEBROW_BANK = [
  "NEW",
  "LIMITED",
  "JUST IN",
  "STARTING TODAY",
  "MADE TO ORDER",
  "FOR THE SEASON",
  "QUIET DROPS",
  "STUDIO RELEASE",
  "FIELD-TESTED",
  "BACK IN",
];

const INGREDIENTS: Record<string, string[]> = {
  cafe: ["single-origin beans", "cold-brewed for 16 hours", "slow-roasted Ethiopian", "house milk", "raw cane"],
  beverage: ["raw fruit", "low sugar", "wild yeast", "real botanicals", "cold-pressed"],
  beauty: ["niacinamide", "ceramides", "plant squalane", "hyaluronic complex", "panthenol"],
  fashion: ["organic cotton", "regenerated wool", "deadstock denim", "low-impact dyes", "Italian linen"],
  fintech: ["zero hidden fees", "FDIC insured", "real-time settlement", "private architecture"],
  saas: ["audit-grade logs", "schema-aware migrations", "first-party telemetry", "zero-config setup"],
  wellness: ["clinically dosed", "third-party tested", "single-origin botanicals", "vegan-clean"],
  hospitality: ["seven rooms only", "local-only sourcing", "no muzak, ever", "an actual fire"],
  ceramics: ["hand-thrown", "wood-fired", "lead-free glaze", "studio-finished"],
  gaming: ["60fps native", "cross-save", "no microtransactions", "modder-friendly"],
  lifestyle: ["unfussy materials", "considered hardware", "real fabric", "fit-for-purpose"],
};

const BENEFITS: Record<string, string[]> = {
  cafe: ["A clearer first hour", "Better cup, less mess", "Specialty without the speech", "Cafe-grade at home"],
  beverage: ["The 3 pm reset, without the crash", "Hydration that earns its place", "A drink you don't have to justify", "Bright without the burn"],
  beauty: ["Skin that behaves on Mondays", "Visible by week two", "Tested on professionals first", "Effective without theatrics"],
  fashion: ["Wears the way it photographs", "Built for ten years of Tuesdays", "The bag you actually use", "Travel-ready without trying"],
  fintech: ["Money where you can see it", "Compounding, finally explained", "Move it without asking permission", "Banking that doesn't lecture"],
  saas: ["Ship without rewriting your stack", "First production query in 9 minutes", "Audit you'd survive", "Built for teams of one to a thousand"],
  wellness: ["Sleep that arrives sooner", "Recovery without a routine", "Energy without an aftertaste", "What your routine was missing"],
  hospitality: ["A weekend that resets the week", "An hour back, every meal", "A room that earned its weight", "Slower, but on purpose"],
  ceramics: ["The mug you'd defend in court", "Settles a table the way salt does", "Heirloom-by-accident", "Goes from oven to dinner"],
  gaming: ["No grind to get to the game", "Skill expressed, not bought", "Twenty hours that stay with you", "The fun is the feature"],
  lifestyle: ["Quiet, correct, and ready", "The default upgrade", "Bought once, used daily", "Designed to disappear into your life"],
};

const PROMISES = [
  "no shouting, no shortcuts",
  "the same answer in every cup",
  "a better default",
  "made well, not just made fast",
  "your time back",
  "fewer choices, better outcomes",
];

const FLAVORS = ["citrus", "grapefruit", "yuzu", "lavender", "fig", "smoked salt", "honey", "pear", "amaranth", "rosemary"];

export interface CopyContext {
  brand: Brand;
  idea: Idea;
  product?: string;
  formatSlug: string;
  seed?: number;
  variantIndex: number;
}

export function generateCopyVariants(ctx: CopyContext, count = 3): CopyVariant[] {
  const seed = ctx.seed ?? hashStr(`${ctx.brand.slug}|${ctx.idea.id}|${ctx.product || ""}|${ctx.formatSlug}|${ctx.variantIndex}`);
  const r = rng(seed);
  const industry = (ctx.brand.industry || "lifestyle").toLowerCase();
  const ingredients = INGREDIENTS[industry] || INGREDIENTS.lifestyle;
  const benefits = BENEFITS[industry] || BENEFITS.lifestyle;

  const variants: CopyVariant[] = [];
  const usedHeadlines = new Set<string>();

  for (let i = 0; i < count * 2 && variants.length < count; i++) {
    const headline = fill(pick(HEADLINE_TEMPLATES, r), {
      product: ctx.product || titleCase(ctx.brand.industry || "the goods"),
      theme: themeShort(ctx.idea.theme),
    });
    if (usedHeadlines.has(headline)) continue;
    usedHeadlines.add(headline);

    const subhead = fill(pick(SUBHEAD_TEMPLATES, r), {
      ingredient: pick(ingredients, r),
      benefit: pick(benefits, r),
      promise: pick(PROMISES, r),
      audience: shortAudience(ctx.idea.audience),
      flavors: pickN(FLAVORS, 3, r).join(", "),
      brand: ctx.brand.name,
    });

    const eyebrow = pick(EYEBROW_BANK, r);
    const cta = pick(CTA_BANK, r);
    variants.push({ eyebrow, headline, subhead, cta });
  }

  return variants;
}

function fill(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] || "");
}

function themeShort(theme: string): string {
  const dash = theme.split("—").pop() || theme;
  return dash.trim().split(" ").slice(-1)[0] || theme;
}

function shortAudience(a: string): string {
  return a.replace(/\s*\(.*?\)/g, "").trim();
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
