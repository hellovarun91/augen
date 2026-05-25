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

// ---------------------------------------------------------------------------
// Intent-first brainstorm: turn a plain-language GOAL into ready-to-build
// projects. Deterministic + goal-aware (so it reads as if it listened), and
// varied by `nonce` so "give me different ones" actually changes the output.
// The AI-backed version (lib/ai/brainstorm.ts) calls this as its fallback.

export interface BrainstormInput { goal: string; count?: number; nonce?: number }

const GOAL_INTENTS: { test: RegExp; arc: string[]; label: string }[] = [
  { test: /launch|drop|introduc|debut|unveil|new (product|line|collection|range)/i, arc: ["awareness", "consideration", "conversion"], label: "launch" },
  { test: /sale|offer|discount|promo|deal|clearance|bundle|%\s*off/i, arc: ["conversion", "conversion", "awareness"], label: "offer" },
  { test: /sign[- ]?up|subscrib|trial|lead|waitlist|demo|register|book a/i, arc: ["consideration", "conversion", "consideration"], label: "signups" },
  { test: /retain|loyal|win[- ]?back|repeat|reorder|churn|come back/i, arc: ["retention", "conversion", "awareness"], label: "retention" },
  { test: /aware|reach|notice|recogni|top of mind|get seen|introduce us/i, arc: ["awareness", "awareness", "consideration"], label: "awareness" },
];

function intentForGoal(goal: string) {
  for (const g of GOAL_INTENTS) if (g.test.test(goal)) return g;
  return { arc: ["awareness", "consideration", "conversion"], label: "campaign" };
}

const STOPWORDS = new Set(["a", "an", "the", "of", "for", "to", "and", "our", "my", "we", "with", "on", "in", "this", "that", "new", "push", "launch", "drive", "grow", "promote", "want", "i", "need"]);

// A short Title-Cased focus phrase pulled from the goal, used in names/themes.
function goalFocusPhrase(goal: string): string {
  const firstClause = goal.split(/[,.;\n]/)[0] || goal;
  const words = firstClause.split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9'-]/g, "")).filter(Boolean);
  const kept = words.filter((w) => !STOPWORDS.has(w.toLowerCase())).slice(0, 4);
  const phrase = (kept.length ? kept : words.slice(0, 3)).join(" ").trim();
  return phrase.replace(/\b\w/g, (c) => c.toUpperCase());
}

const OBJECTIVE_PHRASES: Record<string, string[]> = {
  awareness: ["Get Seen", "First Impression", "Make Noise", "Land the Idea"],
  consideration: ["Make the Case", "Win the Second Look", "Earn the Click", "Show, Don't Tell"],
  conversion: ["Close It", "The Push", "Last Mile", "Make the Yes Easy"],
  retention: ["Bring Them Back", "Stay Top of Mind", "Earn the Reorder"],
};
const OBJECTIVE_LINE: Record<string, string> = {
  awareness: "get the right people to notice and remember the brand.",
  consideration: "move interested people from curious to convinced.",
  conversion: "turn intent into the next concrete step.",
  retention: "bring existing customers back for the next one.",
};

export function brainstormProjects(brand: Brand, input: BrainstormInput): PlannedCampaign[] {
  const goal = (input.goal || "").trim();
  const n = Math.max(1, Math.min(6, Math.round(input.count ?? 3)));
  const r = rng(hashStr(`${brand.slug}|brainstorm|${goal.toLowerCase()}|${input.nonce ?? 0}`));
  const industry = (brand.industry || "lifestyle").toLowerCase();
  const audiences = AUDIENCES_BY_INDUSTRY[industry] || AUDIENCES_BY_INDUSTRY.lifestyle;
  const intent = intentForGoal(goal);
  const now = new Date();
  const q = `Q${Math.floor(now.getMonth() / 3) + 1}` as keyof typeof SEASONAL;
  const season = SEASONAL[q];
  const focus = goalFocusPhrase(goal);

  return Array.from({ length: n }, (_, i) => {
    const objective = intent.arc[i % intent.arc.length];
    const theme = (focus && i === 0) ? focus.toLowerCase() : pick(season.themes, r);
    const audience = pick(audiences, r);
    const ideas = synthesizeIdeas(brand, theme, season.mood, audiences, r);
    // Offset by index so repeated objectives in the arc don't yield duplicate names.
    const phrases = OBJECTIVE_PHRASES[objective] || OBJECTIVE_PHRASES.awareness;
    const phrase = phrases[(Math.floor(r() * phrases.length) + i) % phrases.length];
    const name = focus ? `${focus} — ${phrase}` : `${brand.name} — ${phrase}`;
    const rationale = goal
      ? `Toward your goal — "${goal}". This one drives ${objective}: ${OBJECTIVE_LINE[objective] || ""}`
      : `A ${objective} project: ${OBJECTIVE_LINE[objective] || ""}`;
    return {
      name,
      quarter: q,
      year: now.getFullYear(),
      objective,
      audience,
      productFocus: synthProducts(brand, theme, r),
      channels: pickN(CHANNELS_BY_OBJ[objective] || CHANNELS_BY_OBJ.awareness, 3, r),
      formats: FORMATS_DEFAULT,
      budget: 0,
      kpis: pickN(KPI_BANK, 3, r),
      rationale,
      ideas,
    };
  });
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
