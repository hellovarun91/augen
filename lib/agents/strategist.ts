import type { StrategistInput, StrategistOutput } from "./types";
import { hashStr, pick, pickN, rng } from "@/lib/ai/rand";
import { agentSystem, claudeMaxTokens, claudeModel, extractToolUse, extractUsage, getClaude } from "./adapters/claude";
import type { AgentUsage } from "./persistence";

// Re-uses the planner's idea taxonomy but produces output as if a strategist agent reasoned about it.
// The rationale field is the visible "thinking" trace the operator sees in the chain UI.

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

const VISUAL_DIRECTIONS = [
  "Tabletop, warm tungsten key light, shallow depth, one hand entering frame.",
  "Subject on tinted backdrop, hard shadow at 7°, brand color blocked in lower third.",
  "Slow-motion pour mid-frame, frozen droplet, generous negative space upper right.",
  "Person mid-laugh, neutral wardrobe, ambient daylight, brand surface visible but secondary.",
  "Macro of texture — fiber, foam, grain — cropped tight, almost abstract.",
  "Wide environmental shot, golden hour, subject small in frame, copy lives in sky.",
];

export async function runStrategist(input: StrategistInput): Promise<{ output: StrategistOutput; rationale: string; usage?: AgentUsage }> {
  if (getClaude()) {
    try {
      return await runStrategistClaude(input);
    } catch (e: any) {
      console.warn("[strategist] Claude failed, falling back to mock:", e?.message || e);
    }
  }
  return runStrategistMock(input);
}

async function runStrategistClaude(input: StrategistInput): Promise<{ output: StrategistOutput; rationale: string; usage: AgentUsage }> {
  const client = getClaude()!;
  const system = agentSystem(
    `You are a brand strategist working in an editorial register. You write fewer, stronger ideas, never marketing puffery. Each idea must name a single insight, a specific audience, a promise (what the work will do for the audience), an angle, and a visual direction.\n\nReturn ideas via the emit_ideas tool. Each idea's "theme" should be evocative (2-5 words, capitalize sparingly). Hooks should be ad-ready lines you'd actually use — not category clichés.`,
    input.brand,
    input.language,
  );
  const userText = [
    `Quarter: ${input.quarter || "this period"}${input.year ? " " + input.year : ""}`,
    `Objective: ${input.brief.objective}`,
    `Audience: ${input.brief.audience}`,
    input.brief.productFocus.length ? `Product focus: ${input.brief.productFocus.join(", ")}` : null,
    input.brief.notes ? `Brief notes: ${input.brief.notes}` : null,
    input.notes ? `Operator steer: ${input.notes}` : null,
    "",
    `Draft ${input.count} ideas. Each one should be reachable by a different angle (no two same angle).`,
  ].filter(Boolean).join("\n");

  const resp = await client.messages.create({
    model: claudeModel(),
    max_tokens: claudeMaxTokens(),
    system,
    messages: [{ role: "user", content: userText }],
    tools: [{
      name: "emit_ideas",
      description: "Return the strategist's ideas for this campaign.",
      input_schema: {
        type: "object",
        properties: {
          rationale: { type: "string", description: "One-paragraph strategist note. What you reached for and why. Plain, not hyped." },
          ideas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                theme: { type: "string" },
                insight: { type: "string", description: "One sentence. The real thing the audience is feeling." },
                angle: { type: "string" },
                audience: { type: "string" },
                promise: { type: "string" },
                hooks: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
                visualDirection: { type: "string" },
              },
              required: ["theme", "insight", "angle", "audience", "promise", "hooks", "visualDirection"],
            },
          },
        },
        required: ["rationale", "ideas"],
      },
    }],
    tool_choice: { type: "tool", name: "emit_ideas" },
  });

  const out = extractToolUse<{ rationale: string; ideas: StrategistOutput["ideas"] }>(resp, "emit_ideas");
  return { output: { rationale: out.rationale, ideas: out.ideas }, rationale: out.rationale, usage: extractUsage(resp) };
}

async function runStrategistMock(input: StrategistInput): Promise<{ output: StrategistOutput; rationale: string }> {
  const seedKey = `${input.brand.slug}|${input.quarter || ""}|${input.year || ""}|${input.brief.objective}|${input.notes || ""}`;
  const seed = hashStr(seedKey);
  const r = rng(seed);

  const industry = (input.brand.industry || "lifestyle").toLowerCase();
  const audienceBase = input.brief.audience || "considered buyers 25–44";
  const obj = input.brief.objective;

  const seasonMood = quarterMood(input.quarter);
  const ideas: StrategistOutput["ideas"] = [];

  const themes = [
    "After hours",
    "Open window",
    "First pour",
    "Slow goods",
    "Honest goods",
    "Long light",
    "Field notes",
    "The second cup",
  ];

  for (let i = 0; i < input.count; i++) {
    const angle = pick(ANGLES, r);
    const theme = `${pick(themes, r)} — ${seasonMood}`;
    const insight = pick([
      `The category over-promises and under-shows. We do the opposite.`,
      `${audienceBase.split(",")[0]} buyers don't want a new identity — they want a better default.`,
      `Three weeks before buying, ${input.brand.name} is compared to alternatives. We win the second visit.`,
      `Most ${seasonMood} campaigns talk to the buyer; we talk *about* the buyer to their group.`,
      `When the price is fair and the story is true, the work is to be seen — not to be loud.`,
    ], r);
    const promise = pick([
      `Make the first ${input.brand.name} a clear yes.`,
      `Move the audience from curiosity to a real next step in one ad.`,
      `Replace a daily compromise — show the actual upgrade.`,
      `Land the brand's voice in one line so the next ad is recognized in two beats.`,
    ], r);

    const hooks = pickN(seedHooks(input.brand.name, input.language.preferredWords, input.language.bannedWords, r), 5, r);

    ideas.push({
      theme,
      insight,
      angle,
      audience: audienceBase,
      promise,
      hooks,
      visualDirection: pick(VISUAL_DIRECTIONS, r),
    });
  }

  const rationale = buildStrategistRationale({
    brand: input.brand.name,
    industry,
    obj,
    quarter: input.quarter,
    year: input.year,
    seasonMood,
    audience: audienceBase,
    languageTone: input.language.toneSliders,
    notes: input.notes,
    ideas,
  });

  return { output: { rationale, ideas }, rationale };
}

function quarterMood(q?: string): string {
  switch ((q || "").toUpperCase()) {
    case "Q1": return "renewal";
    case "Q2": return "outward";
    case "Q3": return "abundant";
    case "Q4": return "gathered";
    default: return "considered";
  }
}

function seedHooks(brand: string, preferred: string[], banned: string[], r: () => number): string[] {
  const all = [
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
  const filtered = all.filter((h) => !banned.some((b) => b && h.toLowerCase().includes(b.toLowerCase())));
  // boost: lines that contain a preferred word
  filtered.sort((a, b) => {
    const aMatch = preferred.some((p) => a.toLowerCase().includes(p.toLowerCase())) ? -1 : 0;
    const bMatch = preferred.some((p) => b.toLowerCase().includes(p.toLowerCase())) ? -1 : 0;
    return aMatch - bMatch;
  });
  return filtered;
}

function buildStrategistRationale(args: {
  brand: string; industry: string; obj: string;
  quarter?: string; year?: number; seasonMood: string; audience: string;
  languageTone: { formal_casual: number; serious_playful: number; reserved_bold: number; classic_modern: number };
  notes?: string;
  ideas: StrategistOutput["ideas"];
}): string {
  const t = args.languageTone;
  const toneSummary = [
    Math.abs(t.formal_casual) > 0.2 ? (t.formal_casual > 0 ? "casual register" : "formal register") : null,
    Math.abs(t.serious_playful) > 0.2 ? (t.serious_playful > 0 ? "playful" : "serious") : null,
    Math.abs(t.reserved_bold) > 0.2 ? (t.reserved_bold > 0 ? "bold" : "reserved") : null,
    Math.abs(t.classic_modern) > 0.2 ? (t.classic_modern > 0 ? "modern" : "classic") : null,
  ].filter(Boolean).join(", ") || "balanced register";

  return [
    `Reading ${args.brand} (${args.industry}) for ${args.obj} in ${args.quarter || "this period"}${args.year ? " " + args.year : ""}.`,
    `Seasonal mood is ${args.seasonMood}; audience is ${args.audience}.`,
    `Language tone profile: ${toneSummary}.`,
    args.notes ? `Operator notes: "${args.notes}".` : null,
    `Drafted ${args.ideas.length} ideas. Each one is grounded in a single insight, ties to a different angle, and keeps to the brand's tone.`,
    `If any feels off, ask me to spin it again with a constraint (e.g., "less precious", "category counterpoint").`,
  ].filter(Boolean).join(" ");
}
