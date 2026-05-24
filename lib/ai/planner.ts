import type { Brand, CampaignBrief } from "@/lib/types";
import { hashStr, pick, pickN, rng } from "./rand";

export interface PlannedCampaign {
  name: string;
  quarter: string;
  year: number;
  objective: string;
  audience: string;
  productFocus: string[];
  channels: string[];
  formats: string[];
  budget: number;
  kpis: string[];
  rationale: string;
  ideas: PlannedIdea[];
}

export interface PlannedIdea {
  theme: string;
  insight: string;
  angle: string;
  audience: string;
  promise: string;
  hooks: string[];
  visualDirection: string;
}

const SEASONAL = {
  Q1: { mood: "renewal", themes: ["fresh start", "honest beginnings", "winter quiet", "ritual"], window: "January to March" },
  Q2: { mood: "outward", themes: ["spring forward", "first warm light", "open windows", "patio season"], window: "April to June" },
  Q3: { mood: "abundant", themes: ["long evenings", "summer in a glass", "vacation brain", "after-work"], window: "July to September" },
  Q4: { mood: "gathered", themes: ["gift-giving", "the gathering", "year's end", "candle weather"], window: "October to December" },
};

const ANGLES = [
  "Functional benefit",
  "Hero ingredient",
  "Maker story",
  "Ritual moment",
  "Cultural counterpoint",
  "Side-by-side comparison",
  "Founder POV",
  "Customer in their world",
  "Sensory close-up",
  "The unsaid promise",
];

const AUDIENCES_BY_INDUSTRY: Record<string, string[]> = {
  cafe: ["Local regulars (25-44)", "Remote workers", "Saturday brunchers", "Coffee enthusiasts"],
  beverage: ["Wellness-minded 25-40", "Active families", "Specialty grocer shoppers", "Bartenders and pros"],
  beauty: ["Skin-curious 22-38", "Sensitive-skin loyalists", "Clean-beauty switchers", "Pros and editors"],
  fashion: ["Editorial readers 25-45", "Considered consumers", "Tastemaker 18-30", "Travel-light shoppers"],
  fintech: ["Self-employed founders", "First salary earners", "Switchers from big banks", "Treasury managers"],
  saas: ["Solo operators", "Eng leads at 50-500", "Ops at scale-ups", "Agencies / consultancies"],
  wellness: ["Sleep-seekers 30-50", "Fitness regulars", "First-time supplement buyers", "Practitioners"],
  hospitality: ["Long-weekenders 28-55", "Solo travelers", "Local-first regulars", "Anniversary set"],
  ceramics: ["Home builders 30-50", "Wedding registry shoppers", "Independent retailers", "Hospitality buyers"],
  gaming: ["Core PC gamers 18-30", "Couch co-op pairs", "Streamers", "Returning RPG players"],
  automotive: ["First EV buyers", "Two-car households", "Lease-returners", "City commuters"],
  healthcare: ["First-time-mothers", "Chronic-condition patients", "Caregivers", "GP networks"],
  education: ["Career changers", "Parents researching for kids", "L&D leaders", "Self-taught upgraders"],
  luxury: ["High-net 35-65", "Gift-buyers", "Editorial press", "Collectors"],
  lifestyle: ["Tasteful 28-45", "Apartment dwellers", "New parents", "Empty-nesters refurnishing"],
};

const CTA_BANK = [
  "Try the starter set",
  "Shop the season",
  "Find a store near you",
  "Get the morning kit",
  "Read the story",
  "Order today",
  "Book a tasting",
  "Subscribe and save",
  "Reserve a table",
  "Open an account",
  "Start the trial",
  "Plan your visit",
];

const KPI_BANK = [
  "CTR > 1.4%",
  "CPM under $14",
  "ROAS 2.4x by week 6",
  "+18% aided recall in tracker",
  "Add-to-cart rate +35%",
  "Cost per qualified lead < $32",
  "Engagement rate > 3.2%",
  "Email capture +12% MoM",
  "Repeat-purchase rate +6 pts",
];

const CHANNELS_BY_OBJ: Record<string, string[]> = {
  awareness: ["Meta Reels", "TikTok In-Feed", "YouTube Companion", "Pinterest", "OOH digital"],
  consideration: ["Meta Feed", "LinkedIn Feed", "Google Discovery", "Display"],
  conversion: ["Meta Conversion", "Google Search", "Performance Max", "Retargeting display"],
  retention: ["Email", "Lifecycle ads", "Loyalty push"],
};

const FORMATS_DEFAULT = [
  "meta-feed-1x1",
  "meta-feed-4x5",
  "meta-story-9x16",
  "google-display-300x250",
  "google-display-300x600",
  "linkedin-feed-1x1",
  "pinterest-pin-2x3",
  "tiktok-feed-9x16",
];

export function planQuarter(brand: Brand, year: number, quarter: "Q1" | "Q2" | "Q3" | "Q4", count = 3): PlannedCampaign[] {
  const seed = hashStr(`${brand.slug}-${year}-${quarter}`);
  const r = rng(seed);
  const season = SEASONAL[quarter];
  const industry = (brand.industry || "lifestyle").toLowerCase();
  const audiences = AUDIENCES_BY_INDUSTRY[industry] || AUDIENCES_BY_INDUSTRY.lifestyle;

  // Default to a 3-beat arc (awareness → consideration → conversion); the
  // operator can ask for fewer or more, cycling objectives for extra drafts.
  const objectives = ["awareness", "consideration", "conversion"] as const;
  const n = Math.max(1, Math.min(6, Math.round(count)));
  return Array.from({ length: n }, (_, i) => {
    const obj = objectives[i % objectives.length];
    const themePicked = pick(season.themes, r);
    const angle = pick(ANGLES, r);
    const audience = pick(audiences, r);
    const channels = pickN(CHANNELS_BY_OBJ[obj], 3, r);
    const kpis = pickN(KPI_BANK, 3, r);
    const ideas = synthesizeIdeas(brand, themePicked, season.mood, audiences, r);
    const campaignName = formatCampaignName(brand.name, quarter, year, themePicked);
    return {
      name: campaignName,
      quarter,
      year,
      objective: obj,
      audience,
      productFocus: synthProducts(brand, themePicked, r),
      channels,
      formats: FORMATS_DEFAULT,
      budget: 5000 + Math.floor(r() * 40000),
      kpis,
      rationale: `Drive ${obj} during ${season.window} by leaning into "${themePicked}". The category's seasonal expectation is ${season.mood}; ${brand.name} steps off-trend by holding to its ${brand.tokens.voice.tone[0] || "considered"} register.`,
      ideas,
    };
  });
}

function synthProducts(brand: Brand, theme: string, r: () => number): string[] {
  const industry = (brand.industry || "lifestyle").toLowerCase();
  const map: Record<string, string[]> = {
    cafe: ["House blend", "Cold brew tin", "Single-origin drip", "Pastry pairings"],
    beverage: ["Citrus line", "Limited summer flavor", "Multipack starter", "Single 12oz can"],
    beauty: ["Daily serum", "Travel kit", "Refill pouches", "Limited scent"],
    fashion: ["Core tee restock", "Winter outerwear", "Travel capsule", "Limited collab"],
    fintech: ["Savings vault", "Joint account", "Card refresh", "Wealth onboarding"],
    saas: ["Pro plan", "Team plan", "Enterprise pilot", "New integration"],
    wellness: ["Sleep formula", "Travel pack", "Bundle", "Limited herbal"],
    hospitality: ["Suite stay", "Weekday rate", "Tasting menu", "Holiday package"],
    ceramics: ["Dinner set of four", "Single hand-thrown mug", "Wedding registry box", "Studio seconds"],
    gaming: ["Season pass", "Co-op DLC", "Founder edition", "Cosmetic drop"],
    lifestyle: ["Signature item", "Seasonal bundle", "Travel set", "Refill program"],
  };
  return pickN(map[industry] || map.lifestyle, 3, r);
}

function synthesizeIdeas(
  brand: Brand,
  theme: string,
  mood: string,
  audiences: string[],
  r: () => number,
): PlannedIdea[] {
  const count = 4;
  const out: PlannedIdea[] = [];
  for (let i = 0; i < count; i++) {
    const angle = pick(ANGLES, r);
    const audience = pick(audiences, r);
    const insightTemplates = [
      `The category over-promises and under-shows. We do the opposite.`,
      `${audience.split(" ")[0]} buyers don't want a new identity — they want a better default.`,
      `Search behavior says people compare ${brand.name} to alternatives 3 weeks before buying. We win the second visit.`,
      `Most ${theme} ads talk to the buyer; we talk *about* the buyer to their group.`,
      `When the price is fair and the story is true, the work is to be seen, not to be loud.`,
    ];
    const promiseTemplates = [
      `Make the first ${brand.name} a clear yes.`,
      `Move the audience from curiosity to a real next step in one ad.`,
      `Replace a daily compromise — show the actual upgrade.`,
      `Land the brand's voice in one line so the next ad is recognized in two beats.`,
    ];
    const hooksPool = HOOKS;
    const hooks = pickN(hooksPool, 5, r);
    out.push({
      theme: themeTitle(theme, i),
      insight: pick(insightTemplates, r),
      angle,
      audience,
      promise: pick(promiseTemplates, r),
      hooks,
      visualDirection: visualFor(brand, mood, r),
    });
  }
  return out;
}

const HOOKS = [
  "The honest start to a quiet morning.",
  "Built for the second cup.",
  "Less, but properly.",
  "If you noticed, you're the audience.",
  "Made by hand. Sold by feel.",
  "Made for the way you actually live.",
  "Small batches. Long memory.",
  "Not louder. Better.",
  "An honest answer to a tired category.",
  "Made with intent.",
  "Skip the version that didn't fit.",
  "The shortest distance between you and good.",
  "We picked the harder ingredient.",
  "Closer to the source. Lighter on the language.",
  "First, last, and most days.",
  "Quietly correct.",
  "Worth the wait. Then the wait gets shorter.",
  "Bought once, used daily, replaced rarely.",
];

function themeTitle(theme: string, i: number): string {
  const prefixes = ["After Hours", "Open Window", "First Pour", "Slow Goods", "Honest Goods", "Long Light", "Field Notes"];
  return `${prefixes[i % prefixes.length]} — ${capitalize(theme)}`;
}

function visualFor(brand: Brand, mood: string, r: () => number): string {
  const directions = [
    `Tabletop, warm tungsten key light, shallow depth, one hand entering frame.`,
    `Subject on tinted backdrop, hard shadow at 7°, brand color blocked in lower third.`,
    `Slow-motion pour mid-frame, frozen droplet, generous negative space upper right.`,
    `Person mid-laugh, neutral wardrobe, ambient daylight, brand surface visible but secondary.`,
    `Macro of texture — fiber, foam, grain — cropped tight, almost abstract.`,
    `Wide environmental shot, golden hour, subject small in frame, copy lives in sky.`,
  ];
  return pick(directions, r) + ` Style: ${brand.tokens.imagery.style}. Palette anchored on ${brand.tokens.palette.primary} and ${brand.tokens.palette.accent}.`;
}

function formatCampaignName(brand: string, quarter: string, year: number, theme: string): string {
  return `${brand} — ${quarter} ${year} · ${capitalize(theme)}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function plannedToBrief(p: PlannedCampaign): CampaignBrief {
  return {
    objective: p.objective,
    audience: p.audience,
    productFocus: p.productFocus,
    channels: p.channels,
    formats: p.formats,
    budget: p.budget,
    kpis: p.kpis,
    notes: p.rationale,
  };
}

export { CTA_BANK };
