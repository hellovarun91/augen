"use client";
import { Button, Card, Eyebrow, Input, Label, TextArea } from "@/components/ui/primitives";
import type { Brand, BrandLanguage } from "@/lib/types";
import { useState, useTransition } from "react";
import { saveLanguage, criticPreview } from "./actions";
import { AdPreviewPreview } from "@/components/ad-preview";
import { Slider } from "@/components/ui/slider";

const SLIDERS: Array<{ key: keyof BrandLanguage["toneSliders"]; left: string; right: string }> = [
  { key: "formal_casual", left: "Formal", right: "Casual" },
  { key: "serious_playful", left: "Serious", right: "Playful" },
  { key: "reserved_bold", left: "Reserved", right: "Bold" },
  { key: "classic_modern", left: "Classic", right: "Modern" },
];

const SLOTS: Array<{ key: keyof BrandLanguage["exemplars"]; label: string; placeholder: string }> = [
  { key: "headline", label: "Headlines", placeholder: "A headline that sounds unmistakably like the brand." },
  { key: "subhead", label: "Subheads", placeholder: "A supporting line in voice." },
  { key: "eyebrow", label: "Eyebrows", placeholder: "e.g. NEW · FIELD-TESTED" },
  { key: "cta", label: "CTAs", placeholder: "e.g. Start learning" },
];

const MECH = {
  headlineCase: { label: "Headline case", options: [["sentence", "Sentence case"], ["title", "Title Case"], ["lower", "all lowercase"]] },
  exclamations: { label: "Exclamation marks", options: [["never", "Never"], ["sparing", "Sparingly"], ["ok", "Allowed"]] },
  emoji: { label: "Emoji", options: [["never", "Never"], ["sparing", "Sparingly"], ["ok", "Allowed"]] },
  numerals: { label: "Numbers", options: [["numerals", "Numerals (7)"], ["spell-small", "Spell under 10"], ["words", "Words (seven)"]] },
  contractions: { label: "Contractions", options: [["use", "Use (it's)"], ["avoid", "Avoid (it is)"]] },
} as const;

export function LanguageEditor({ brand }: { brand: Brand }) {
  // Migrate legacy flat sample sentences into the Headlines exemplar bucket on first view.
  const initial = (() => {
    const l = brand.language;
    const ex = l.exemplars;
    const empty = !(ex.eyebrow.length || ex.headline.length || ex.subhead.length || ex.cta.length);
    return empty && l.sampleSentences.length ? { ...l, exemplars: { ...ex, headline: l.sampleSentences } } : l;
  })();

  const [lang, setLang] = useState<BrandLanguage>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  const [draft, setDraft] = useState({ pref: "", ban: "", do_: "", dont: "", swapFrom: "", swapTo: "", eyebrow: "", headline: "", subhead: "", cta: "" });
  const [criticResult, setCriticResult] = useState<{ score: number; voiceFit: number; formatFit: number; conceptStrength: number; verdict: string; notes: string[] } | null>(null);
  const [bench, setBench] = useState({
    headline: initial.exemplars.headline[0] || `${brand.name}.\nQuietly correct.`,
    subhead: initial.exemplars.subhead[0] || "Made for the way you live, not the way the category sells.",
    cta: initial.exemplars.cta[0] || "Shop the season",
  });

  function patch<K extends keyof BrandLanguage>(k: K, v: BrandLanguage[K]) { setLang({ ...lang, [k]: v }); }
  function patchSlider(k: keyof BrandLanguage["toneSliders"], v: number) {
    setLang({ ...lang, toneSliders: { ...lang.toneSliders, [k]: v } });
  }
  function patchMech<K extends keyof BrandLanguage["mechanics"]>(k: K, v: BrandLanguage["mechanics"][K]) {
    setLang({ ...lang, mechanics: { ...lang.mechanics, [k]: v } });
  }
  type ListKey = "preferredWords" | "bannedWords" | "doRules" | "doNotRules";
  function addTo(list: ListKey, value: string, draftKey: keyof typeof draft) {
    const v = value.trim(); if (!v) return;
    patch(list, [...lang[list], v] as any);
    setDraft({ ...draft, [draftKey]: "" });
  }
  function removeFrom(list: ListKey, idx: number) {
    const next = [...lang[list]]; next.splice(idx, 1); patch(list, next as any);
  }
  function addExemplar(slot: keyof BrandLanguage["exemplars"], draftKey: keyof typeof draft) {
    const v = draft[draftKey].trim(); if (!v) return;
    setLang({ ...lang, exemplars: { ...lang.exemplars, [slot]: [...lang.exemplars[slot], v] } });
    setDraft({ ...draft, [draftKey]: "" });
  }
  function removeExemplar(slot: keyof BrandLanguage["exemplars"], idx: number) {
    const next = [...lang.exemplars[slot]]; next.splice(idx, 1);
    setLang({ ...lang, exemplars: { ...lang.exemplars, [slot]: next } });
  }
  function addSwap() {
    const from = draft.swapFrom.trim(), to = draft.swapTo.trim();
    if (!from || !to) return;
    patch("wordSwaps", [...lang.wordSwaps, { from, to }]);
    setDraft({ ...draft, swapFrom: "", swapTo: "" });
  }
  function removeSwap(idx: number) { const next = [...lang.wordSwaps]; next.splice(idx, 1); patch("wordSwaps", next); }

  function onSave() {
    setError(null);
    start(async () => {
      try {
        await saveLanguage(brand.id, lang);
        setSaved(true); setBump((v) => v + 1); setTimeout(() => setSaved(false), 1500);
      } catch (e: any) { setError(e?.message || "Save failed"); }
    });
  }
  function testLine() {
    setError(null);
    start(async () => {
      try {
        const r = await criticPreview(brand.id, lang, { ...bench, eyebrow: lang.exemplars.eyebrow[0] || "FIELD-TESTED" }, "meta-feed-4x5");
        setCriticResult(r);
      } catch (e: any) { setError(e?.message || "Critic failed"); }
    });
  }

  return (
    <div className="grid lg:grid-cols-[1fr,420px] gap-6">
      <div className="space-y-6">
        <Card className="p-6">
          <Eyebrow>Voice description</Eyebrow>
          <TextArea className="mt-3" rows={4} value={lang.voiceDescription} onChange={(e) => patch("voiceDescription", e.target.value)}
            placeholder="A short paragraph describing how the brand sounds — register, rhythm, what it would never say." />
        </Card>

        <Card className="p-6 space-y-5">
          <Eyebrow>Tone</Eyebrow>
          {SLIDERS.map((s) => (
            <Slider key={s.key} value={lang.toneSliders[s.key]} min={-1} max={1} step={0.05} bipolar
              leftLabel={s.left} rightLabel={s.right} onChange={(v) => patchSlider(s.key, v)} />
          ))}
        </Card>

        <Card className="p-6 space-y-3">
          <Eyebrow>Lexicon</Eyebrow>
          <div className="grid md:grid-cols-2 gap-4">
            <Listy title="Preferred words" hint="Lines that use these get promoted." items={lang.preferredWords} draft={draft.pref}
              setDraft={(v) => setDraft({ ...draft, pref: v })} onAdd={() => addTo("preferredWords", draft.pref, "pref")} onRemove={(i) => removeFrom("preferredWords", i)} tone="ok" placeholder="e.g. quiet, considered, made" />
            <Listy title="Banned words" hint="Filtered out of every generation. Critic flags violations." items={lang.bannedWords} draft={draft.ban}
              setDraft={(v) => setDraft({ ...draft, ban: v })} onAdd={() => addTo("bannedWords", draft.ban, "ban")} onRemove={(i) => removeFrom("bannedWords", i)} tone="danger" placeholder="e.g. unleash, game-changing, hustle" />
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <Eyebrow>Word swaps</Eyebrow>
          <div className="text-xs text-ink-400">Say-this-not-that. The Copywriter rewrites the left into the right, every time.</div>
          <div className="flex gap-2 items-center pt-1">
            <Input value={draft.swapFrom} onChange={(e) => setDraft({ ...draft, swapFrom: e.target.value })} placeholder="instead of… (users)" />
            <span className="text-ink-500">→</span>
            <Input value={draft.swapTo} onChange={(e) => setDraft({ ...draft, swapTo: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSwap(); } }} placeholder="say… (members)" />
            <Button size="sm" variant="secondary" onClick={addSwap}>Add</Button>
          </div>
          {lang.wordSwaps.length === 0 ? <div className="text-[11px] text-ink-500">— none —</div> : (
            <ul className="space-y-1.5 pt-1">
              {lang.wordSwaps.map((w, i) => (
                <li key={i} className="rounded-md px-3 py-1.5 text-sm ring-1 ring-white/10 bg-white/5 flex items-center justify-between">
                  <span><span className="text-rose-300 line-through">{w.from}</span> <span className="text-ink-500">→</span> <span className="text-emerald-200">{w.to}</span></span>
                  <button onClick={() => removeSwap(i)} className="text-[11px] text-ink-300 hover:text-white">✕</button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 space-y-3">
          <Eyebrow>Do / Don't</Eyebrow>
          <div className="grid md:grid-cols-2 gap-4">
            <Listy title="Do" hint="Behaviors copy should embody." items={lang.doRules} draft={draft.do_}
              setDraft={(v) => setDraft({ ...draft, do_: v })} onAdd={() => addTo("doRules", draft.do_, "do_")} onRemove={(i) => removeFrom("doRules", i)} tone="ok" placeholder="e.g. lead with the benefit" />
            <Listy title="Don't" hint="Behaviors to avoid." items={lang.doNotRules} draft={draft.dont}
              setDraft={(v) => setDraft({ ...draft, dont: v })} onAdd={() => addTo("doNotRules", draft.dont, "dont")} onRemove={(i) => removeFrom("doNotRules", i)} tone="danger" placeholder="e.g. manufactured urgency" />
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <Eyebrow>Style mechanics</Eyebrow>
          <div className="text-xs text-ink-400">The conventions that keep copy consistent across every writer and every ad.</div>
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            {(Object.keys(MECH) as Array<keyof typeof MECH>).map((k) => (
              <div key={k} className="space-y-1">
                <Label>{MECH[k].label}</Label>
                <select value={(lang.mechanics as any)[k]} onChange={(e) => patchMech(k as any, e.target.value as any)}
                  className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10">
                  {MECH[k].options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm text-ink-200 self-end pb-2">
              <input type="checkbox" checked={lang.mechanics.oxfordComma} onChange={(e) => patchMech("oxfordComma", e.target.checked)} />
              Oxford comma
            </label>
          </div>
          <TextArea rows={2} value={lang.mechanics.notes} onChange={(e) => patchMech("notes", e.target.value)} placeholder="Any other house rules (e.g. 'never start a headline with a verb', '£ before the number')." />
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <Eyebrow>Exemplars by slot</Eyebrow>
            <div className="text-xs text-ink-400 mt-1">Real lines that sound right, anchored per slot. The strongest signal the Copywriter has — give it 2–3 each.</div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {SLOTS.map((s) => (
              <Listy key={s.key} title={s.label} hint="" items={lang.exemplars[s.key]} draft={draft[s.key] as string}
                setDraft={(v) => setDraft({ ...draft, [s.key]: v })} onAdd={() => addExemplar(s.key, s.key)} onRemove={(i) => removeExemplar(s.key, i)} tone="neutral" placeholder={s.placeholder} />
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <Eyebrow>Length caps</Eyebrow>
          <div className="text-xs text-ink-400">Brand defaults. Tight format crops (banners, stories) automatically clamp below these per generation.</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {(["headlineMaxChars", "subheadMaxChars", "ctaMaxChars", "eyebrowMaxChars"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label>{k.replace("MaxChars", "")} max</Label>
                <Input type="number" value={lang.copyLimits[k]} className="text-sm"
                  onChange={(e) => { const v = parseInt(e.target.value || "0", 10); setLang({ ...lang, copyLimits: { ...lang.copyLimits, [k]: isNaN(v) ? lang.copyLimits[k] : v } }); }} />
              </div>
            ))}
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={onSave} disabled={pending}>{pending ? "Saving…" : "Save language"}</Button>
          {saved && <span className="text-xs text-emerald-300">Saved — agents will use this immediately.</span>}
          {error && <span className="text-xs text-rose-300">{error}</span>}
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto pr-1">
        <Card className="p-4">
          <Eyebrow>Live preview · 4:5 feed</Eyebrow>
          <div className="mt-3 max-w-sm mx-auto">
            <AdPreviewPreview key={bump + "-pv"} brandId={brand.id} formatSlug="meta-feed-4x5"
              copy={{ eyebrow: bench.headline ? (lang.exemplars.eyebrow[0] || "FIELD-TESTED") : "FIELD-TESTED", headline: bench.headline, subhead: bench.subhead, cta: bench.cta || "Shop the season" }} />
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div>
            <Eyebrow>Test a line</Eyebrow>
            <div className="text-[11px] text-ink-400 mt-1">Write a candidate against the voice above (unsaved edits included) and ask the QC Critic.</div>
          </div>
          <div className="space-y-2">
            <TextArea rows={2} value={bench.headline} onChange={(e) => setBench({ ...bench, headline: e.target.value })} placeholder="Headline" />
            <Input value={bench.subhead} onChange={(e) => setBench({ ...bench, subhead: e.target.value })} placeholder="Subhead" />
            <Input value={bench.cta} onChange={(e) => setBench({ ...bench, cta: e.target.value })} placeholder="CTA" />
          </div>
          <Button size="sm" variant="secondary" onClick={testLine} disabled={pending}>{pending ? "Reading…" : "Ask the Critic →"}</Button>
          {criticResult && (
            <div className="rounded-lg ring-1 ring-white/5 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className={criticResult.verdict === "ship" ? "text-emerald-300" : criticResult.verdict === "kill" ? "text-rose-300" : "text-amber-300"}>{criticResult.verdict.toUpperCase()}</span>
                <span className="text-ink-100">{Math.round(criticResult.score * 100)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-ink-400">
                <div>voice {Math.round(criticResult.voiceFit * 100)}</div>
                <div>format {Math.round(criticResult.formatFit * 100)}</div>
                <div>concept {Math.round(criticResult.conceptStrength * 100)}</div>
              </div>
              {criticResult.notes.length > 0 && (
                <ul className="text-[11px] text-ink-300 mt-2 space-y-0.5">
                  {criticResult.notes.slice(0, 5).map((n, i) => <li key={i}>· {n}</li>)}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Listy({
  title, hint, items, draft, setDraft, onAdd, onRemove, tone, placeholder, stacked = false,
}: {
  title: string; hint?: string; items: string[]; draft: string; setDraft: (s: string) => void;
  onAdd: () => void; onRemove: (i: number) => void; tone: "ok" | "danger" | "neutral"; placeholder: string; stacked?: boolean;
}) {
  const colorMap = {
    ok: "bg-emerald-500/10 text-emerald-200 ring-emerald-500/25",
    danger: "bg-rose-500/10 text-rose-200 ring-rose-500/25",
    neutral: "bg-white/5 text-ink-200 ring-white/10",
  } as const;

  if (!stacked) {
    // Compact tag input: chips and the field share one bordered box, wrap, and
    // scroll past a capped height so a long lexicon never runs away vertically.
    return (
      <div className="space-y-1.5">
        {title && <div className="text-sm text-ink-100">{title}</div>}
        {hint && <div className="text-[11px] text-ink-400">{hint}</div>}
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg ring-1 ring-white/10 bg-ink-900/40 px-2 py-1.5 max-h-28 overflow-y-auto focus-within:ring-white/25 transition-shadow">
          {items.map((s, i) => (
            <span key={i} className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] ring-1 " + colorMap[tone]}>
              <span className="whitespace-pre-wrap">{s}</span>
              <button type="button" onClick={() => onRemove(i)} className="text-ink-300 hover:text-white leading-none shrink-0">×</button>
            </span>
          ))}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); onAdd(); }
              else if (e.key === "Backspace" && !draft && items.length) { onRemove(items.length - 1); }
            }}
            onBlur={() => { if (draft.trim()) onAdd(); }}
            placeholder={items.length ? "Add…" : placeholder}
            className="flex-1 min-w-[90px] bg-transparent text-sm px-1 py-0.5 outline-none placeholder:text-ink-500"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title && <div className="text-sm text-ink-100">{title}</div>}
      {hint && <div className="text-[11px] text-ink-400">{hint}</div>}
      <div className="flex gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }} placeholder={placeholder} />
        <Button size="sm" variant="secondary" onClick={onAdd}>Add</Button>
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-ink-500">— empty —</div>
      ) : (
        <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {items.map((s, i) => (
            <li key={i} className={"rounded-md px-3 py-1.5 text-sm ring-1 flex items-start justify-between gap-2 " + colorMap[tone]}>
              <span className="whitespace-pre-wrap">{s}</span>
              <button type="button" onClick={() => onRemove(i)} className="text-[11px] text-ink-300 hover:text-white shrink-0 leading-5">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
