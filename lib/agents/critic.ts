import type { CriticInput, CriticOutput } from "./types";
import { formatBySlug } from "@/lib/formats";

export async function runCritic(input: CriticInput): Promise<{ output: CriticOutput; rationale: string }> {
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
