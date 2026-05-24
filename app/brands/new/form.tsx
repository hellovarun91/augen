"use client";
import { Badge, Button, Eyebrow, Input, Label, TextArea } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { synthesizeBrandPreview, confirmBrand } from "./actions";
import type { BrandSynth } from "@/lib/ai/brand-builder";
import type { BrandTokens } from "@/lib/types";

const PALETTE_KEYS: { key: keyof BrandTokens["palette"]; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface" },
  { key: "foreground", label: "Foreground" },
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "muted", label: "Muted" },
];

export function NewBrandForm({ presets }: { presets: { label: string; body: string }[] }) {
  const [phase, setPhase] = useState<"input" | "review">("input");
  const [brief, setBrief] = useState("");
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [autoDraft, setAutoDraft] = useState<"next" | "none">("next");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Editable foundation, hydrated from the synthesizer's draft.
  const [synth, setSynth] = useState<BrandSynth | null>(null);
  const [draftName, setDraftName] = useState("");
  const [tagline, setTagline] = useState("");
  const [palette, setPalette] = useState<BrandTokens["palette"] | null>(null);
  const [voiceDesc, setVoiceDesc] = useState("");
  const [sourced, setSourced] = useState(false);

  function synthesize() {
    setError(null);
    start(async () => {
      try {
        const { synth: s, sourcedFromUrl } = await synthesizeBrandPreview({ brief, url, name });
        setSynth(s);
        setDraftName(s.name);
        setTagline(s.tagline);
        setPalette({ ...s.tokens.palette });
        setVoiceDesc(s.tokens.voice.description);
        setSourced(sourcedFromUrl);
        setPhase("review");
      } catch (e: any) {
        setError(e?.message || "Could not synthesize");
      }
    });
  }

  function create() {
    if (!synth || !palette) return;
    setError(null);
    start(async () => {
      try {
        const tokens = {
          ...synth.tokens,
          name: draftName.trim() || synth.tokens.name,
          palette,
          voice: { ...synth.tokens.voice, description: voiceDesc },
          locker: { ...synth.tokens.locker, wordmark: (draftName.trim() || synth.name).toUpperCase() },
        };
        await confirmBrand({
          name: draftName,
          tagline,
          industry: synth.industry,
          description: synth.description,
          tokens,
          autoDraft,
        });
        // confirmBrand redirects on success; nothing after runs.
      } catch (e: any) {
        setError(e?.message || "Could not create brand");
      }
    });
  }

  if (phase === "review" && synth && palette) {
    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Review the foundation{sourced ? " · read from your site" : ""}</Eyebrow>
            <p className="text-sm text-ink-300 mt-1 max-w-xl">Tweak anything here, or create and refine later. Everything stays editable — palette, type, voice, imagery.</p>
          </div>
          <button onClick={() => { setPhase("input"); setError(null); }} className="text-xs text-ink-400 hover:text-ink-100 shrink-0">← Edit brief</button>
        </div>

        {/* Identity preview banner */}
        <div className="rounded-2xl p-6 ring-1 ring-white/10" style={{ background: `linear-gradient(135deg, ${palette.primary}, ${palette.accent})` }}>
          <div className="text-[11px] uppercase tracking-wider" style={{ color: palette.background, opacity: 0.85 }}>{synth.industry}</div>
          <div className="serif text-3xl tracking-tight mt-1" style={{ color: palette.background }}>{draftName || "Untitled"}</div>
          <div className="mt-2 text-sm max-w-lg" style={{ color: palette.background, opacity: 0.95 }}>{tagline || "—"}</div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Brand name</Label>
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <Label>Palette</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PALETTE_KEYS.map(({ key, label }) => (
              <div key={key} className="rounded-xl ring-1 ring-white/10 p-3 space-y-2">
                <div className="text-[11px] text-ink-400">{label}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={palette[key]}
                    onChange={(e) => setPalette({ ...palette, [key]: e.target.value })}
                    className="h-8 w-8 rounded-md cursor-pointer bg-transparent border-0 p-0"
                    aria-label={label}
                  />
                  <input
                    value={palette[key]}
                    onChange={(e) => setPalette({ ...palette, [key]: e.target.value })}
                    className="w-full bg-transparent text-xs text-ink-200 font-mono outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Voice</Label>
          <TextArea rows={3} value={voiceDesc} onChange={(e) => setVoiceDesc(e.target.value)} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {synth.tokens.voice.tone.map((t) => <Badge key={t}>{t}</Badge>)}
          </div>
          {synth.tokens.voice.doNot.length > 0 && (
            <div className="text-xs text-ink-400 pt-1">Never: {synth.tokens.voice.doNot.join(" · ")}</div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div>
            <Eyebrow>Type</Eyebrow>
            <div className="text-ink-200 mt-1">{synth.tokens.fonts.display} · {synth.tokens.fonts.body}</div>
          </div>
          <div>
            <Eyebrow>Imagery</Eyebrow>
            <div className="text-ink-200 mt-1 capitalize">{synth.tokens.imagery.style}{synth.tokens.imagery.treatment ? ` · ${synth.tokens.imagery.treatment}` : ""}</div>
          </div>
        </div>

        <div className="space-y-2 max-w-md">
          <Label>Auto-draft quarter</Label>
          <select value={autoDraft} onChange={(e) => setAutoDraft(e.target.value as "next" | "none")} className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10">
            <option value="next">Yes — draft 3 projects for the next quarter</option>
            <option value="none">No — just create the brand</option>
          </select>
        </div>

        {error && <div className="text-sm text-rose-300">{error}</div>}

        <div className="flex items-center gap-3 pt-2">
          <Button size="lg" onClick={create} disabled={pending}>{pending ? "Creating…" : "Create brand →"}</Button>
          <button onClick={() => synthesize()} disabled={pending} className="text-xs text-ink-400 hover:text-ink-100">Re-synthesize</button>
        </div>
      </div>
    );
  }

  // Input phase
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Brief</Label>
        <TextArea
          rows={7}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Tanda is a small-batch kombucha brand making bright, low-sugar drinks. Quietly confident voice — calm, premium, considered…"
        />
        <div className="text-xs text-ink-400">Be specific about audience and voice. The more honest the brief, the better the system.</div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Website <span className="text-ink-500">(optional — we'll read it)</span></Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="tanda.com" />
        </div>
        <div className="space-y-2">
          <Label>Brand name <span className="text-ink-500">(optional override)</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Augen picks one if blank" />
        </div>
      </div>

      <div className="space-y-2">
        <Eyebrow>Presets</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              type="button"
              key={p.label}
              onClick={() => { setBrief(p.body); setName(p.label); }}
              className="rounded-full px-3 py-1.5 text-xs ring-1 ring-white/10 text-ink-200 hover:bg-white/5"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-sm text-rose-300">{error}</div>}

      <div className="flex items-center gap-3">
        <Button size="lg" onClick={synthesize} disabled={pending || (brief.trim().length < 16 && !url.trim())}>
          {pending ? "Synthesizing…" : "Synthesize →"}
        </Button>
        <div className="text-xs text-ink-400">You'll review the foundation before anything is created.</div>
      </div>
    </div>
  );
}
