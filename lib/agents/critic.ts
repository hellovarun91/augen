import type { Brand, BrandLanguage } from "@/lib/types";
import type { CriticInput, CriticOutput } from "./types";
import { formatBySlug } from "@/lib/formats";
import { agentSystem, claudeMaxTokens, claudeModel, extractToolUse, extractUsage, getClaude } from "./adapters/claude";
import type { AgentUsage } from "./persistence";

const CRITIC_ROLE = `You are a brand QC Critic. Score each ad on three axes (0-1): voiceFit (does it sound like the brand?), formatFit (does headline length and rhythm match this format crop?), conceptStrength (is there a real idea here, or is it generic?). Be strict — most ads should land 0.65-0.85. Return ship/revise/kill plus 3-6 specific notes (wins or issues, each one short). If verdict is revise, write a one-sentence revisionNote with what to ask for.`;

// Shared per-ad critique fields. The batch tool wraps these in an array with an index.
const CRITIQUE_PROPS = {
  score: { type: "number", minimum: 0, maximum: 1 },
  voiceFit: { type: "number", minimum: 0, maximum: 1 },
  formatFit: { type: "number", minimum: 0, maximum: 1 },
  conceptStrength: { type: "number", minimum: 0, maximum: 1 },
  verdict: { type: "string", enum: ["ship", "revise", "kill"] },
  notes: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
  revisionNote: { type: "string" },
  rationale: { type: "string" },
} as const;

export async function runCritic(input: CriticInput): Promise<{ output: CriticOutput; rationale: string; usage?: AgentUsage }> {
  if (getClaude()) {
    try { return await runCriticClaude(input); }
    catch (e: any) { console.warn("[critic] Claude failed, falling back to mock:", e?.message || e); }
  }
  return runCriticMock(input);
}

async function runCriticClaude(input: CriticInput): Promise<{ output: CriticOutput; rationale: string; usage: AgentUsage }> {
  const client = getClaude()!;
  const fmt = formatBySlug(input.formatSlug);
  const system = agentSystem(CRITIC_ROLE, input.brand, input.language);

  const userText = [
    `Format: ${fmt ? `${fmt.name} (${fmt.width}×${fmt.height}, ${fmt.aspect})` : input.formatSlug}`,
    input.idea ? `Idea theme: ${input.idea.theme}` : "",
    "",
    `Eyebrow: ${input.copy.eyebrow}`,
    `Headline: ${input.copy.headline}`,
    `Subhead: ${input.copy.subhead}`,
    `CTA: ${input.copy.cta}`,
  ].filter(Boolean).join("\n");

  const resp = await client.messages.create({
    model: claudeModel(),
    max_tokens: claudeMaxTokens(),
    system,
    messages: [{ role: "user", content: userText }],
    tools: [{
      name: "emit_critique",
      description: "Return the critic's verdict on this ad.",
      input_schema: {
        type: "object",
        properties: { ...CRITIQUE_PROPS },
        required: ["score", "voiceFit", "formatFit", "conceptStrength", "verdict", "notes", "rationale"],
      },
    }],
    tool_choice: { type: "tool", name: "emit_critique" },
  });

  const out = extractToolUse<{
    score: number; voiceFit: number; formatFit: number; conceptStrength: number;
    verdict: CriticOutput["verdict"]; notes: string[]; revisionNote?: string; rationale: string;
  }>(resp, "emit_critique");

  return {
    output: {
      score: out.score, voiceFit: out.voiceFit, formatFit: out.formatFit, conceptStrength: out.conceptStrength,
      verdict: out.verdict, notes: out.notes, revisionNote: out.revisionNote,
    },
    rationale: out.rationale,
    usage: extractUsage(resp),
  };
}

async function runCriticMock(input: CriticInput): Promise<{ output: CriticOutput; rationale: string }> {
  const notes: string[] = [];
  const wins: string[] = [];
  const head = (input.copy.headline || "").trim();
  const headFlat = head.replace(/\s+/g, " ");
  const sub = (input.copy.subhead || "").trim();
  const fmt = formatBySlug(input.formatSlug);

  // ---- Voice fit
  let voiceFit = 0.85;
  const banned = (input.language.bannedWords || []).map((w) => w.toLowerCase()).filter(Boolean);
  const blob = (head + " " + sub).toLowerCase();
  const offenders = banned.filter((b) => blob.includes(b));
  if (offenders.length) {
    voiceFit -= Math.min(0.4, 0.1 * offenders.length);
    notes.push(`Headline or subhead contains brand-banned word(s): ${offenders.join(", ")}.`);
  }
  const preferred = (input.language.preferredWords || []).map((w) => w.toLowerCase());
  const preferredHits = preferred.filter((p) => blob.includes(p));
  if (preferredHits.length) {
    voiceFit = Math.min(1, voiceFit + 0.04);
    wins.push(`Uses preferred language: ${preferredHits.slice(0, 3).join(", ")}.`);
  }
  if (/!\s|!$/.test(head) && (input.language.toneSliders?.serious_playful ?? 0) <= 0) {
    voiceFit -= 0.08;
    notes.push(`Exclamation in headline pushes against the serious end of the tone profile.`);
  }
  if (/[A-Z]{4,}\b/.test(headFlat)) {
    voiceFit -= 0.06;
    notes.push(`ALL-CAPS run in headline reads shoutier than the brand's voice.`);
  }

  // ---- Format fit
  let formatFit = 0.9;
  const headLen = headFlat.length;
  if (fmt) {
    // Approximate ergonomics by aspect/size
    const ratio = fmt.width / fmt.height;
    if (ratio >= 3) {
      // ultra-wide banner — short headline wins
      if (headLen > 28) { formatFit -= 0.18; notes.push(`Banner crop favors ≤28 chars; this headline is ${headLen}.`); }
      else wins.push(`Headline length sits well in a wide banner crop.`);
    } else if (ratio >= 1.5) {
      if (headLen > 42) { formatFit -= 0.1; notes.push(`Link-card crop favors ≤42 chars; this headline is ${headLen}.`); }
    } else if (ratio <= 0.6) {
      // tall — verticals do well with 2-3 stacked lines
      const lines = head.split(/\n+/).length;
      if (lines > 4) { formatFit -= 0.1; notes.push(`Vertical formats read best at 2–3 lines; this is ${lines}.`); }
      if (lines < 2) { formatFit -= 0.04; notes.push(`Vertical headline could carry one more line for rhythm.`); }
    }
  }

  // ---- Concept strength (rough)
  let conceptStrength = 0.78;
  if (input.idea) {
    const themeTail = (input.idea.theme || "").split("—").pop()?.trim().toLowerCase() || "";
    if (themeTail && blob.includes(themeTail.split(" ").slice(-1)[0]!)) {
      conceptStrength += 0.05;
      wins.push(`Echoes the idea theme inside the copy.`);
    }
  }
  if (head.length >= 12 && head.length <= 38) conceptStrength += 0.05;
  if (sub.length >= 24 && sub.length <= 96) conceptStrength += 0.03;
  if (head.toLowerCase().includes(input.brand.name.toLowerCase())) {
    conceptStrength += 0.04;
    wins.push(`Brand-name foregrounded.`);
  }
  conceptStrength = Math.min(1, conceptStrength);

  // ---- Aggregate
  const score = clamp(voiceFit * 0.45 + formatFit * 0.3 + conceptStrength * 0.25, 0, 1);
  const verdict: CriticOutput["verdict"] = score >= 0.85 ? "ship" : score >= 0.6 ? "revise" : "kill";

  const revisionNote = verdict === "revise" ? buildRevisionNote({ headLen, ratio: fmt ? fmt.width / fmt.height : 1, offenders, head, fmtName: fmt?.name }) : undefined;

  const rationale = [
    `Scored ${(score * 100).toFixed(0)} (voice ${pct(voiceFit)} · format ${pct(formatFit)} · concept ${pct(conceptStrength)}).`,
    wins.length ? `Wins: ${wins.join(" ")}` : null,
    notes.length ? `Issues: ${notes.join(" ")}` : null,
    `Verdict: ${verdict}.${revisionNote ? " Suggested ask: " + revisionNote : ""}`,
  ].filter(Boolean).join(" ");

  return {
    output: { score, voiceFit: clamp(voiceFit, 0, 1), formatFit: clamp(formatFit, 0, 1), conceptStrength, verdict, notes: [...wins, ...notes], revisionNote },
    rationale,
  };
}

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function pct(n: number) { return `${Math.round(n * 100)}`; }
function buildRevisionNote(args: { headLen: number; ratio: number; offenders: string[]; head: string; fmtName?: string }): string {
  if (args.offenders.length) return `Rewrite without ${args.offenders.join(" / ")} — try a benefit-led line instead.`;
  if (args.ratio >= 3 && args.headLen > 28) return `Tighter headline ≤ 28 chars for ${args.fmtName || "this banner crop"}.`;
  if (args.ratio <= 0.6 && args.head.split("\n").length < 2) return `Add a second stacked line for rhythm in the vertical crop.`;
  return `Try a sharper concept — lead with the benefit and cut one adjective.`;
}

// ---------------------------------------------------------------------------
// Batch critic — score N ads in a single Claude call instead of one-per-ad.
// The brand context (cached) is sent once for the whole batch, and the per-ad
// output is small, so a chunk of ~8 ads costs roughly one ad's worth of input.
// The orchestrator chunks the campaign and calls this once per chunk.

export interface CriticBatchItem {
  formatSlug: string;
  copy: CriticInput["copy"];
  idea?: CriticInput["idea"];
}

export interface CriticBatchInput {
  brand: Brand;
  language: BrandLanguage;
  items: CriticBatchItem[];
}

export interface CriticBatchResult {
  output: { critiques: CriticOutput[]; count: number };
  rationale: string;
  usage?: AgentUsage;
}

export async function runCriticBatch(input: CriticBatchInput): Promise<CriticBatchResult> {
  if (!input.items.length) return { output: { critiques: [], count: 0 }, rationale: "No ads to critique." };
  if (getClaude()) {
    try { return await runCriticBatchClaude(input); }
    catch (e: any) { console.warn("[critic] batch Claude failed, falling back to mock:", e?.message || e); }
  }
  return runCriticBatchMock(input);
}

async function runCriticBatchClaude(input: CriticBatchInput): Promise<CriticBatchResult> {
  const client = getClaude()!;
  const system = agentSystem(
    `${CRITIC_ROLE}\n\nYou are reviewing a batch of ads in one pass. Return one critique per ad via the emit_critiques tool, each carrying the ad's "index" exactly as labeled. Judge every ad independently — do not let one ad's verdict bleed into another.`,
    input.brand,
    input.language,
  );

  const adBlocks = input.items.map((it, i) => {
    const fmt = formatBySlug(it.formatSlug);
    return [
      `--- Ad ${i} ---`,
      `Format: ${fmt ? `${fmt.name} (${fmt.width}×${fmt.height}, ${fmt.aspect})` : it.formatSlug}`,
      it.idea ? `Idea theme: ${it.idea.theme}` : "",
      `Eyebrow: ${it.copy.eyebrow}`,
      `Headline: ${it.copy.headline}`,
      `Subhead: ${it.copy.subhead}`,
      `CTA: ${it.copy.cta}`,
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  const userText = `Critique each of the following ${input.items.length} ads. Use the ad's index in your response.\n\n${adBlocks}`;

  const resp = await client.messages.create({
    model: claudeModel(),
    max_tokens: claudeMaxTokens(),
    system,
    messages: [{ role: "user", content: userText }],
    tools: [{
      name: "emit_critiques",
      description: "Return one critique per ad in the batch.",
      input_schema: {
        type: "object",
        properties: {
          critiques: {
            type: "array",
            items: {
              type: "object",
              properties: { index: { type: "integer", minimum: 0 }, ...CRITIQUE_PROPS },
              required: ["index", "score", "voiceFit", "formatFit", "conceptStrength", "verdict", "notes", "rationale"],
            },
          },
        },
        required: ["critiques"],
      },
    }],
    tool_choice: { type: "tool", name: "emit_critiques" },
  });

  const out = extractToolUse<{ critiques: Array<{
    index: number; score: number; voiceFit: number; formatFit: number; conceptStrength: number;
    verdict: CriticOutput["verdict"]; notes: string[]; revisionNote?: string; rationale: string;
  }> }>(resp, "emit_critiques");

  // Align by index; fill any ad the model skipped with a deterministic mock score.
  const critiques: CriticOutput[] = new Array(input.items.length);
  for (const c of out.critiques || []) {
    if (c.index == null || c.index < 0 || c.index >= input.items.length) continue;
    critiques[c.index] = {
      score: c.score, voiceFit: c.voiceFit, formatFit: c.formatFit, conceptStrength: c.conceptStrength,
      verdict: c.verdict, notes: c.notes, revisionNote: c.revisionNote,
    };
  }
  for (let i = 0; i < input.items.length; i++) {
    if (!critiques[i]) {
      const m = await runCriticMock({ brand: input.brand, language: input.language, ...input.items[i] });
      critiques[i] = m.output;
    }
  }

  return {
    output: { critiques, count: critiques.length },
    rationale: batchRationale(critiques),
    usage: extractUsage(resp),
  };
}

async function runCriticBatchMock(input: CriticBatchInput): Promise<CriticBatchResult> {
  const critiques: CriticOutput[] = [];
  for (const it of input.items) {
    const m = await runCriticMock({ brand: input.brand, language: input.language, ...it });
    critiques.push(m.output);
  }
  return { output: { critiques, count: critiques.length }, rationale: batchRationale(critiques) };
}

function batchRationale(critiques: CriticOutput[]): string {
  const tally = { ship: 0, revise: 0, kill: 0 };
  for (const c of critiques) tally[c.verdict]++;
  return `Batch QC over ${critiques.length} ad${critiques.length === 1 ? "" : "s"} — ${tally.ship} ship · ${tally.revise} revise · ${tally.kill} kill.`;
}
