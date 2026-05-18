import type { CopyVariant, CopywriterInput, CopywriterOutput } from "./types";
import { hashStr, pick, pickN, rng } from "@/lib/ai/rand";
import { brandSystemBlock, claudeMaxTokens, claudeModel, extractToolUse, extractUsage, getClaude } from "./adapters/claude";
import type { AgentUsage } from "./persistence";
import { formatBySlug } from "@/lib/formats";

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
  "{adj}\n{noun}.\nFinally.",
  "{adj} {product}.\nFor the rest of\nthe year.",
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
  "NEW", "LIMITED", "JUST IN", "STARTING TODAY", "MADE TO ORDER", "FOR THE SEASON",
  "QUIET DROPS", "STUDIO RELEASE", "FIELD-TESTED", "BACK IN",
];

const CTA_BANK = [
  "Try the starter set", "Shop the season", "Find a store near you", "Get the morning kit",
  "Read the story", "Order today", "Book a tasting", "Subscribe and save", "Reserve a table",
  "Open an account", "Start the trial", "Plan your visit",
];

const ADJ = ["Honest", "Quiet", "Sharp", "Plain", "Steady", "Slow", "Clear", "Daily", "Whole", "Worn-in"];
const NOUN = ["goods", "kit", "edition", "release", "lineup", "set", "morning", "ritual"];

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

export async function runCopywriter(input: CopywriterInput): Promise<{ output: CopywriterOutput; rationale: string; usage?: AgentUsage }> {
  if (getClaude()) {
    try { return await runCopywriterClaude(input); }
    catch (e: any) { console.warn("[copywriter] Claude failed, falling back to mock:", e?.message || e); }
  }
  return runCopywriterMock(input);
}

async function runCopywriterClaude(input: CopywriterInput): Promise<{ output: CopywriterOutput; rationale: string; usage: AgentUsage }> {
  const client = getClaude()!;
  const fmt = formatBySlug(input.formatSlug);
  const ratio = fmt ? fmt.width / fmt.height : 1;
  const headlineMax = ratio >= 3 ? 28 : ratio >= 1.5 ? 42 : 60;

  const system = [
    {
      type: "text" as const,
      text: `You are a brand copywriter. Write ad copy in the brand's voice. Each variant has: eyebrow (2-3 words, ALL CAPS allowed only here), headline (use \\n linebreaks for stacking on portrait/square), subhead (one sentence, under ~100 chars), CTA (verb-led, ≤4 words). Honor banned words strictly. Respect operator constraints. Never use exclamation marks unless the tone profile leans playful.`,
      cache_control: { type: "ephemeral" as const },
    },
    brandSystemBlock(input.brand, input.language),
  ];

  const userText = [
    `Idea theme: ${input.idea.theme}`,
    (input.idea as any).insight ? `Insight: ${(input.idea as any).insight}` : "",
    `Angle: ${input.idea.angle}`,
    `Audience: ${input.idea.audience}`,
    input.product ? `Product focus: ${input.product}` : "",
    `Format: ${fmt ? `${fmt.name} (${fmt.width}×${fmt.height}, ${fmt.aspect})` : input.formatSlug}`,
    `Headline char budget (max): ${headlineMax}`,
    input.constraints ? `Operator constraint: ${input.constraints}` : "",
    input.carryForward?.length ? `Do NOT repeat these prior headlines:\n${input.carryForward.slice(0, 12).map((h) => `- ${h.replace(/\n/g, " ")}`).join("\n")}` : "",
    "",
    `Draft ${input.count} variants. Each must be voice-correct and feel like it could appear at this format size.`,
  ].filter(Boolean).join("\n");

  const resp = await client.messages.create({
    model: claudeModel(),
    max_tokens: claudeMaxTokens(),
    system,
    messages: [{ role: "user", content: userText }],
    tools: [{
      name: "emit_variants",
      description: "Return copy variants for this ad.",
      input_schema: {
        type: "object",
        properties: {
          rationale: { type: "string" },
          variants: {
            type: "array",
            items: {
              type: "object",
              properties: {
                eyebrow: { type: "string" },
                headline: { type: "string" },
                subhead: { type: "string" },
                cta: { type: "string" },
              },
              required: ["eyebrow", "headline", "subhead", "cta"],
            },
          },
        },
        required: ["rationale", "variants"],
      },
    }],
    tool_choice: { type: "tool", name: "emit_variants" },
  });

  const out = extractToolUse<{ rationale: string; variants: CopyVariant[] }>(resp, "emit_variants");
  return { output: { rationale: out.rationale, variants: out.variants }, rationale: out.rationale, usage: extractUsage(resp) };
}

async function runCopywriterMock(input: CopywriterInput): Promise<{ output: CopywriterOutput; rationale: string }> {
  const seedKey = `${input.brand.slug}|${input.idea.theme}|${input.product || ""}|${input.formatSlug}|v${input.variantIndex}|${input.constraints || ""}|${(input.carryForward || []).length}`;
  const seed = hashStr(seedKey);
  const r = rng(seed);

  const industry = (input.brand.industry || "lifestyle").toLowerCase();
  const ingredients = INGREDIENTS[industry] || INGREDIENTS.lifestyle;
  const benefits = BENEFITS[industry] || BENEFITS.lifestyle;

  const banned = (input.language.bannedWords || []).map((w) => w.toLowerCase());
  const preferred = (input.language.preferredWords || []).map((w) => w.toLowerCase());
  const carry = new Set((input.carryForward || []).map((h) => h.trim()));

  // Apply constraint adjustments
  const cons = (input.constraints || "").toLowerCase();
  const wantsShorter = /shorter|tighter|crisper|trim/.test(cons);
  const wantsBolder = /bold|louder|punchier|stronger/.test(cons);
  const wantsBenefit = /benefit|outcome|what.*get|results?/.test(cons);
  const wantsConcrete = /concrete|specific|less precious|simpler|honest/.test(cons);

  const variants: CopyVariant[] = [];
  const usedHeadlines = new Set<string>();
  let attempts = 0;
  while (variants.length < input.count && attempts < input.count * 5) {
    attempts++;
    const product = input.product || titleCase(industry === "lifestyle" ? "the goods" : industry);
    let template = pick(HEADLINE_TEMPLATES, r);
    if (wantsShorter && template.length > 30) template = pick(HEADLINE_TEMPLATES.filter((t) => t.length <= 30), r) || template;
    let headline = fill(template, {
      product,
      theme: themeShort(input.idea.theme),
      adj: pick(ADJ, r),
      noun: pick(NOUN, r),
    });

    if (banned.length && containsBannedWord(headline, banned)) continue;
    if (carry.has(headline.trim())) continue;
    if (usedHeadlines.has(headline)) continue;
    usedHeadlines.add(headline);

    let subhead = fill(pick(SUBHEAD_TEMPLATES, r), {
      ingredient: pick(ingredients, r),
      benefit: wantsBenefit ? pick(benefits, r) : pick(benefits, r),
      promise: pick(PROMISES, r),
      audience: shortAudience(input.idea.audience),
      flavors: pickN(FLAVORS, 3, r).join(", "),
      brand: input.brand.name,
    });

    if (wantsConcrete) {
      subhead = subhead.replace(/Designed to be the default — not the experiment\./, `${pick(benefits, r)}.`);
    }
    if (banned.length && containsBannedWord(subhead, banned)) {
      subhead = subhead.split(" ").filter((w) => !banned.includes(w.toLowerCase().replace(/[^a-z]/g, ""))).join(" ");
    }

    const eyebrow = wantsBolder ? pick(["LIMITED", "JUST IN", "STARTING TODAY"], r) : pick(EYEBROW_BANK, r);
    const cta = pick(CTA_BANK, r);

    variants.push({ eyebrow, headline, subhead, cta });
  }

  // Promote variants containing a preferred word
  variants.sort((a, b) => preferenceScore(b, preferred) - preferenceScore(a, preferred));

  const rationale = [
    `Drafted ${variants.length} variants${input.constraints ? ` honoring "${input.constraints}"` : ""}.`,
    preferred.length ? `Promoted lines that use preferred words (${preferred.slice(0, 5).join(", ")}).` : null,
    banned.length ? `Filtered out anything matching the brand's banned list.` : null,
    `Keep what lands — star a winner and I'll write 10 more in that register.`,
  ].filter(Boolean).join(" ");

  return { output: { rationale, variants }, rationale };
}

function fill(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] || "");
}
function containsBannedWord(text: string, banned: string[]): boolean {
  const lc = text.toLowerCase();
  return banned.some((b) => b && lc.includes(b));
}
function themeShort(theme: string): string {
  const dash = theme.split("—").pop() || theme;
  return (dash.trim().split(" ").slice(-1)[0] || theme).replace(/[.,]/g, "");
}
function shortAudience(a: string): string { return a.replace(/\s*\(.*?\)/g, "").trim(); }
function titleCase(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
function preferenceScore(v: CopyVariant, preferred: string[]): number {
  if (!preferred.length) return 0;
  const blob = (v.headline + " " + v.subhead).toLowerCase();
  return preferred.reduce((n, w) => n + (blob.includes(w) ? 1 : 0), 0);
}
