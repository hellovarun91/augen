"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Eyebrow } from "@/components/ui/primitives";
import { runVisualQcAction } from "@/app/ads/[id]/actions";
import type { VisionCritique } from "@/lib/agents/vision-critic";

const AXES: { key: keyof VisionCritique; label: string }[] = [
  { key: "legibility", label: "Legibility" },
  { key: "contrast", label: "Contrast" },
  { key: "composition", label: "Composition" },
  { key: "safeArea", label: "Safe area" },
  { key: "brandFit", label: "Brand fit" },
];

function tone(score: number) { return score >= 0.85 ? "ok" : score >= 0.6 ? "warn" : "danger"; }
function barColor(score: number) { return score >= 0.85 ? "#34d399" : score >= 0.6 ? "#fbbf24" : "#fb7185"; }

export function VisualQC({ id, initialScore, initialNotes }: { id: string; initialScore: number | null; initialNotes: string | null }) {
  const [crit, setCrit] = useState<VisionCritique | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function run() {
    setError(null);
    start(async () => {
      try { const c = await runVisualQcAction(id); setCrit(c); router.refresh(); }
      catch (e: any) { setError(e?.message || "Could not run visual QC"); }
    });
  }

  // Show the freshly-run critique if present; otherwise the stored summary.
  if (!crit) {
    return (
      <div className="space-y-3">
        {initialScore != null ? (
          <div className="flex items-center gap-3">
            <span className="serif text-3xl tracking-tight" style={{ color: barColor(initialScore) }}>{Math.round(initialScore * 100)}</span>
            <span className="text-ink-400 text-sm">/ 100 design score</span>
            <Badge tone={tone(initialScore) as any}>last run</Badge>
          </div>
        ) : (
          <p className="text-sm text-ink-300">No visual QC yet. Run it to score the rendered creative — legibility, contrast, composition, safe area, brand fit.</p>
        )}
        {initialNotes && <p className="text-sm text-ink-300">{initialNotes}</p>}
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={run} disabled={pending}>{pending ? "Looking…" : initialScore != null ? "Re-run visual QC" : "Run visual QC"}</Button>
          {error && <span className="text-xs text-rose-300">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="serif text-3xl tracking-tight" style={{ color: barColor(crit.overallScore) }}>{Math.round(crit.overallScore * 100)}</span>
        <span className="text-ink-400 text-sm">/ 100</span>
        <Badge tone={crit.verdict === "ship" ? "ok" : crit.verdict === "kill" ? "danger" : "warn"}>{crit.verdict}</Badge>
        <Badge tone={crit.viaVision ? "info" : "neutral"}>{crit.viaVision ? "vision" : "heuristic"}</Badge>
      </div>

      <div className="space-y-1.5">
        {AXES.map(({ key, label }) => {
          const v = crit[key] as number;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-ink-400 w-24 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: barColor(v) }} />
              </div>
              <span className="text-[11px] text-ink-500 w-7 text-right">{Math.round(v * 100)}</span>
            </div>
          );
        })}
      </div>

      {crit.notes.length > 0 && (
        <div>
          <Eyebrow>What it sees</Eyebrow>
          <ul className="text-sm text-ink-200 mt-1.5 space-y-1">{crit.notes.map((n, i) => <li key={i}>· {n}</li>)}</ul>
        </div>
      )}
      {crit.fixes.length > 0 && (
        <div>
          <Eyebrow>Suggested fixes</Eyebrow>
          <ul className="text-sm text-ink-200 mt-1.5 space-y-1">{crit.fixes.map((f, i) => <li key={i}>→ {f}</li>)}</ul>
        </div>
      )}

      <Button size="sm" variant="ghost" onClick={run} disabled={pending}>{pending ? "Looking…" : "Re-run"}</Button>
      {error && <span className="text-xs text-rose-300 ml-2">{error}</span>}
    </div>
  );
}
