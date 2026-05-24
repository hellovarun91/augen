"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Eyebrow, Input } from "@/components/ui/primitives";
import { previewRefineAction, applyRefineAction } from "@/app/brands/[slug]/refine-actions";
import type { BrandTokens } from "@/lib/types";

const QUICK = ["Warmer palette", "Cooler palette", "Darker & moodier", "Bolder voice", "More minimal", "More premium"];
const PALETTE_KEYS: (keyof BrandTokens["palette"])[] = ["background", "surface", "foreground", "primary", "secondary", "accent", "muted"];

export function RefineWithAI({ brandId, currentPalette, currentTone }: {
  brandId: string;
  currentPalette: BrandTokens["palette"];
  currentTone: string[];
}) {
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<{ tokens: BrandTokens; summary: string; viaAI: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function doPreview(text?: string) {
    const ins = (text ?? instruction).trim();
    if (text) setInstruction(text);
    if (ins.length < 2) { setError("Tell Augen what to change."); return; }
    setError(null);
    start(async () => {
      try {
        const r = await previewRefineAction(brandId, ins);
        setPreview(r as { tokens: BrandTokens; summary: string; viaAI: boolean });
      } catch (e: any) { setError(e?.message || "Could not refine"); }
    });
  }

  function apply() {
    if (!preview) return;
    setError(null);
    start(async () => {
      try {
        await applyRefineAction(brandId, preview.tokens);
        setPreview(null); setInstruction("");
        router.refresh();
      } catch (e: any) { setError(e?.message || "Could not apply"); }
    });
  }

  const after = preview?.tokens.palette;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") doPreview(); }}
          placeholder="e.g. warm up the palette and make the voice a little bolder"
          className="flex-1"
        />
        <Button onClick={() => doPreview()} disabled={pending}>{pending ? "Thinking…" : "Preview changes"}</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => doPreview(q)} disabled={pending}
            className="rounded-full px-3 py-1 text-[11px] ring-1 ring-white/10 text-ink-300 hover:bg-white/5">
            {q}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-rose-300">{error}</div>}

      {preview && after && (
        <div className="rounded-xl ring-1 ring-white/10 p-4 space-y-4 bg-ink-900/40">
          <div className="flex items-center gap-2">
            <Eyebrow>Proposed</Eyebrow>
            <Badge tone={preview.viaAI ? "info" : "neutral"}>{preview.viaAI ? "AI" : "heuristic"}</Badge>
          </div>
          <p className="text-sm text-ink-200">{preview.summary}</p>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-ink-500 w-12">before</span>
              {PALETTE_KEYS.map((k) => <span key={k} title={`${k}: ${currentPalette[k]}`} className="w-6 h-6 rounded-md ring-1 ring-white/10" style={{ background: currentPalette[k] }} />)}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-ink-500 w-12">after</span>
              {PALETTE_KEYS.map((k) => {
                const changed = after[k].toLowerCase() !== currentPalette[k].toLowerCase();
                return <span key={k} title={`${k}: ${after[k]}`} className={`w-6 h-6 rounded-md ring-1 ${changed ? "ring-white/60" : "ring-white/10"}`} style={{ background: after[k] }} />;
              })}
            </div>
          </div>

          {JSON.stringify(preview.tokens.voice.tone) !== JSON.stringify(currentTone) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-500 mr-1">tone →</span>
              {preview.tokens.voice.tone.map((t) => <Badge key={t} tone={currentTone.includes(t) ? "neutral" : "info"}>{t}</Badge>)}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button size="sm" onClick={apply} disabled={pending}>{pending ? "Applying…" : "Apply"}</Button>
            <button onClick={() => setPreview(null)} disabled={pending} className="text-xs text-ink-400 hover:text-ink-100">Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
