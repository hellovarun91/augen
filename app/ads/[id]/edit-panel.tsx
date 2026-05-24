"use client";
import { Button, Card, Eyebrow, Input, Label } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { AdOverrides } from "@/lib/composer/overrides";
import { saveOverridesAction, clearOverridesAction, replaceImageAction, removeReplacedImageAction } from "./actions";
import type { BrandTokens } from "@/lib/types";

interface Props {
  generationId: string;
  headline: string;
  overrides: AdOverrides;
  tokens: BrandTokens;
  reloadKey: number;
  onReload: () => void;
}

export function EditPanel({ generationId, headline, overrides, tokens, onReload }: Props) {
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<AdOverrides>(overrides);
  const [open, setOpen] = useState<string | null>("typography");
  const [emphasisDraft, setEmphasisDraft] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: any, optimistic?: AdOverrides) {
    if (optimistic) setLocal(optimistic);
    setError(null);
    start(async () => {
      try {
        await saveOverridesAction(generationId, patch);
        onReload();
      } catch (e: any) { setError(e?.message || "Save failed"); }
    });
  }

  async function clearAll() {
    setError(null);
    start(async () => {
      try {
        await clearOverridesAction(generationId);
        setLocal({
          typography: { emphasis: [] },
          layout: { ctaPosition: "auto", lockerVisible: true, headlineYShift: 0 },
          image: { transparent: false, crop: { panX: 0, panY: 0, scale: 1 }, filter: "none" },
          colors: {},
        } as AdOverrides);
        onReload();
      } catch (e: any) { setError(e?.message || "Clear failed"); }
    });
  }

  function addEmphasis() {
    const w = emphasisDraft.trim();
    if (!w) return;
    const next = { typography: { emphasis: [...local.typography.emphasis, { word: w, style: "accent" }] } };
    save(next, { ...local, typography: { ...local.typography, emphasis: [...local.typography.emphasis, { word: w, style: "accent" }] } });
    setEmphasisDraft("");
  }
  function removeEmphasis(idx: number) {
    const arr = [...local.typography.emphasis];
    arr.splice(idx, 1);
    save({ typography: { emphasis: arr } }, { ...local, typography: { ...local.typography, emphasis: arr } });
  }
  function setEmphasisStyle(idx: number, style: "accent" | "italic" | "underline" | "muted") {
    const arr = [...local.typography.emphasis];
    arr[idx] = { ...arr[idx], style };
    save({ typography: { emphasis: arr } }, { ...local, typography: { ...local.typography, emphasis: arr } });
  }

  function setHeadlineScale(v: number) { save({ typography: { headlineScale: v } }, { ...local, typography: { ...local.typography, headlineScale: v } }); }
  function setSubheadScale(v: number) { save({ typography: { subheadScale: v } }, { ...local, typography: { ...local.typography, subheadScale: v } }); }
  function setCtaScale(v: number) { save({ typography: { ctaScale: v } }, { ...local, typography: { ...local.typography, ctaScale: v } }); }
  function setEyebrowScale(v: number) { save({ typography: { eyebrowScale: v } }, { ...local, typography: { ...local.typography, eyebrowScale: v } }); }
  function setTracking(v: number) { save({ typography: { tracking: v } }, { ...local, typography: { ...local.typography, tracking: v } }); }
  function setWeight(v: any) { save({ typography: { headlineWeight: v } }, { ...local, typography: { ...local.typography, headlineWeight: v } }); }

  function setCtaPos(v: any) { save({ layout: { ctaPosition: v } }, { ...local, layout: { ...local.layout, ctaPosition: v } }); }
  function setLocker(v: boolean) { save({ layout: { lockerVisible: v } }, { ...local, layout: { ...local.layout, lockerVisible: v } }); }
  function setScrim(v: number) { save({ layout: { scrimOpacity: v } }, { ...local, layout: { ...local.layout, scrimOpacity: v } }); }
  function setCoverage(v: number) { save({ layout: { scrimCoverage: v } }, { ...local, layout: { ...local.layout, scrimCoverage: v } }); }
  function setYShift(v: number) { save({ layout: { headlineYShift: v } }, { ...local, layout: { ...local.layout, headlineYShift: v } }); }

  function setCrop(panX: number, panY: number, scale: number) {
    save({ image: { crop: { panX, panY, scale } } }, { ...local, image: { ...local.image, crop: { panX, panY, scale } } });
  }
  function setFilter(v: any) { save({ image: { filter: v } }, { ...local, image: { ...local.image, filter: v } }); }

  function setColor(slot: keyof AdOverrides["colors"], v: string) {
    const colors = { ...local.colors, [slot]: v || undefined };
    save({ colors: { [slot]: v || null } }, { ...local, colors });
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Eyebrow>Custom edits</Eyebrow>
          <div className="text-xs text-ink-400 mt-1">Tweak this one ad. Zero AI cost — just re-renders.</div>
        </div>
        <button onClick={clearAll} disabled={pending} className="text-[11px] text-ink-400 hover:text-rose-300">Reset all</button>
      </div>
      {error && <div className="text-xs text-rose-300">{error}</div>}
      {info && <div className="text-xs text-emerald-300">{info}</div>}

      {/* Typography */}
      <Section title="Typography" isOpen={open === "typography"} onToggle={() => setOpen(open === "typography" ? null : "typography")}>
        <Slider label={`Headline size (×${(local.typography.headlineScale ?? 1).toFixed(2)})`} value={local.typography.headlineScale ?? 1} onChange={setHeadlineScale} min={0.5} max={1.6} step={0.02} />
        <Slider label={`Subhead size (×${(local.typography.subheadScale ?? 1).toFixed(2)})`} value={local.typography.subheadScale ?? 1} onChange={setSubheadScale} min={0.6} max={1.5} step={0.02} />
        <Slider label={`Eyebrow size (×${(local.typography.eyebrowScale ?? 1).toFixed(2)})`} value={local.typography.eyebrowScale ?? 1} onChange={setEyebrowScale} min={0.6} max={1.5} step={0.02} />
        <Slider label={`CTA size (×${(local.typography.ctaScale ?? 1).toFixed(2)})`} value={local.typography.ctaScale ?? 1} onChange={setCtaScale} min={0.7} max={1.4} step={0.02} />
        <Slider label={`Tracking (${(local.typography.tracking ?? tokens.type.tracking).toFixed(3)})`} value={local.typography.tracking ?? tokens.type.tracking} onChange={setTracking} min={-0.06} max={0.04} step={0.005} />
        <div className="flex items-center gap-2 text-xs">
          <Label>Weight</Label>
          <select
            value={local.typography.headlineWeight || "medium"}
            onChange={(e) => setWeight(e.target.value)}
            className="rounded-lg bg-ink-800 px-2 py-1 text-xs ring-1 ring-inset ring-white/10"
          >
            {["light", "regular", "medium", "semibold", "bold"].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <div className="pt-3 border-t border-white/5">
          <Label>Word emphasis in headline</Label>
          <div className="text-[11px] text-ink-400 mt-1">Highlight one or more words from the headline. Style: accent color, italic, underline, or muted.</div>
          <div className="flex gap-2 mt-2">
            <select
              value={emphasisDraft}
              onChange={(e) => setEmphasisDraft(e.target.value)}
              className="flex-1 rounded-lg bg-ink-800 px-2 py-1.5 text-xs ring-1 ring-inset ring-white/10"
            >
              <option value="">— pick a word —</option>
              {wordsOf(headline).map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <Button size="sm" variant="secondary" onClick={addEmphasis} disabled={!emphasisDraft.trim()}>Add</Button>
          </div>
          {local.typography.emphasis.length > 0 && (
            <ul className="space-y-1.5 mt-3">
              {local.typography.emphasis.map((e, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-white/5 ring-1 ring-white/10 px-2 py-0.5">{e.word}</span>
                  <select
                    value={e.style}
                    onChange={(ev) => setEmphasisStyle(i, ev.target.value as any)}
                    className="rounded-lg bg-ink-800 px-2 py-0.5 text-[11px] ring-1 ring-inset ring-white/10"
                  >
                    <option value="accent">Accent color</option>
                    <option value="italic">Italic</option>
                    <option value="underline">Underline</option>
                    <option value="muted">Muted</option>
                  </select>
                  <button onClick={() => removeEmphasis(i)} className="ml-auto text-ink-400 hover:text-rose-300">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* Layout */}
      <Section title="Layout" isOpen={open === "layout"} onToggle={() => setOpen(open === "layout" ? null : "layout")}>
        <div>
          <Label>CTA placement</Label>
          <div className="grid grid-cols-5 gap-1 mt-1">
            {(["auto", "top-right", "bottom-right", "bottom-left", "inline-right"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setCtaPos(p)}
                className={"text-[10px] rounded-full px-2 py-1 ring-1 transition-colors " + (local.layout.ctaPosition === p ? "bg-ink-50 text-ink-950 ring-ink-50" : "bg-ink-800 text-ink-200 ring-white/10 hover:bg-ink-700")}
              >
                {p.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>
        <Slider label={`Headline Y shift (${(local.layout.headlineYShift ?? 0 * 100).toFixed(0)}%)`} value={local.layout.headlineYShift ?? 0} onChange={setYShift} min={-0.3} max={0.3} step={0.01} />
        <Slider label={`Scrim opacity (${(local.layout.scrimOpacity ?? tokens.scrim.bottomOpacity).toFixed(2)})`} value={local.layout.scrimOpacity ?? tokens.scrim.bottomOpacity} onChange={setScrim} min={0} max={1} step={0.05} />
        <Slider label={`Scrim coverage (${(local.layout.scrimCoverage ?? tokens.scrim.coverage).toFixed(2)})`} value={local.layout.scrimCoverage ?? tokens.scrim.coverage} onChange={setCoverage} min={0.2} max={1} step={0.05} />
        <label className="flex items-center gap-2 text-xs text-ink-200">
          <input type="checkbox" checked={local.layout.lockerVisible !== false} onChange={(e) => setLocker(e.target.checked)} />
          Show locker (brand wordmark)
        </label>
      </Section>

      {/* Image */}
      <Section title="Image" isOpen={open === "image"} onToggle={() => setOpen(open === "image" ? null : "image")}>
        <Slider label={`Zoom (×${local.image.crop.scale.toFixed(2)})`} value={local.image.crop.scale} onChange={(v) => setCrop(local.image.crop.panX, local.image.crop.panY, v)} min={0.5} max={3} step={0.05} />
        <Slider label={`Pan X (${(local.image.crop.panX * 100).toFixed(0)}%)`} value={local.image.crop.panX} onChange={(v) => setCrop(v, local.image.crop.panY, local.image.crop.scale)} min={-1} max={1} step={0.02} />
        <Slider label={`Pan Y (${(local.image.crop.panY * 100).toFixed(0)}%)`} value={local.image.crop.panY} onChange={(v) => setCrop(local.image.crop.panX, v, local.image.crop.scale)} min={-1} max={1} step={0.02} />
        <div>
          <Label>Filter</Label>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {(["none", "grayscale", "warm", "cool", "dark", "light"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={"text-[10px] rounded-full px-2 py-1 ring-1 transition-colors " + (local.image.filter === f ? "bg-ink-50 text-ink-950 ring-ink-50" : "bg-ink-800 text-ink-200 ring-white/10 hover:bg-ink-700")}
              >{f}</button>
            ))}
          </div>
        </div>
        <ImageReplace generationId={generationId} hasReplacement={!!local.image.replaceUrl} transparent={local.image.transparent} onReload={onReload} />
      </Section>

      {/* Colors */}
      <Section title="Colors" isOpen={open === "colors"} onToggle={() => setOpen(open === "colors" ? null : "colors")}>
        <ColorRow label="Eyebrow" value={local.colors.eyebrow || ""} onChange={(v) => setColor("eyebrow", v)} placeholder="auto" />
        <ColorRow label="Headline" value={local.colors.headline || ""} onChange={(v) => setColor("headline", v)} placeholder="auto" />
        <ColorRow label="Subhead" value={local.colors.subhead || ""} onChange={(v) => setColor("subhead", v)} placeholder="auto" />
        <ColorRow label="CTA" value={local.colors.cta || ""} onChange={(v) => setColor("cta", v)} placeholder="auto" />
        <ColorRow label="Rule" value={local.colors.rule || ""} onChange={(v) => setColor("rule", v)} placeholder={tokens.palette.accent} />
      </Section>
    </Card>
  );
}

function Section({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl ring-1 ring-white/5 bg-ink-900/40">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-ink-100">
        <span>{title}</span>
        <span className="text-ink-400">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen && <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">{children}</div>}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-ink-300 mb-1.5">
        <span>{label}</span><span className="text-ink-500 tabular-nums">{value.toFixed(2)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="aug-slider"
        style={{ background: `linear-gradient(to right, rgba(255,255,255,0.85) ${pct}%, rgba(255,255,255,0.10) ${pct}%)` }}
      />
    </div>
  );
}

function ColorRow({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="!text-[11px] w-16 !text-ink-300">{label}</Label>
      <input type="color" value={value || "#cccccc"} onChange={(e) => onChange(e.target.value)} className="h-7 w-10 rounded-md ring-1 ring-white/10 bg-ink-800 cursor-pointer" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="font-mono text-xs flex-1" />
      {value && <button onClick={() => onChange("")} className="text-[11px] text-ink-400 hover:text-rose-300">clear</button>}
    </div>
  );
}

function ImageReplace({ generationId, hasReplacement, transparent, onReload }: { generationId: string; hasReplacement: boolean; transparent: boolean; onReload: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="pt-3 border-t border-white/5">
      <Label>Replace image</Label>
      {hasReplacement && <div className="text-[11px] text-emerald-300 mt-1">Using a custom uploaded image{transparent ? " (transparent)" : ""}.</div>}
      <form
        className="space-y-2 mt-2"
        action={(fd) => start(async () => {
          setErr(null);
          try { await replaceImageAction(generationId, fd); onReload(); }
          catch (e: any) { setErr(e?.message || "Upload failed"); }
        })}
      >
        <input name="file" type="file" accept="image/*" className="block w-full text-xs text-ink-200 file:mr-3 file:rounded-full file:border-0 file:bg-ink-700 file:text-ink-50 file:text-xs file:px-3 file:py-1.5 hover:file:bg-ink-600" />
        <label className="flex items-center gap-2 text-[11px] text-ink-300">
          <input type="checkbox" name="transparent" value="1" />
          Subject-only PNG (preserve transparency)
        </label>
        <div className="flex gap-2">
          <Button size="sm" type="submit" disabled={pending}>{pending ? "Uploading…" : "Upload"}</Button>
          {hasReplacement && (
            <button
              type="button"
              onClick={() => start(async () => { await removeReplacedImageAction(generationId); onReload(); })}
              className="text-xs text-ink-300 hover:text-rose-300"
            >
              Revert to original
            </button>
          )}
        </div>
        {err && <div className="text-[11px] text-rose-300">{err}</div>}
      </form>
    </div>
  );
}

function wordsOf(s: string): string[] {
  const set = new Set<string>();
  for (const w of s.split(/[\s\n]+/)) {
    const clean = w.replace(/[^\p{L}\p{N}'-]/gu, "");
    if (clean.length >= 2) set.add(clean);
  }
  return Array.from(set);
}
