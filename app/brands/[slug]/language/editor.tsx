"use client";
import { Button, Card, Eyebrow, Input, Label, TextArea } from "@/components/ui/primitives";
import type { Brand, BrandLanguage } from "@/lib/types";
import { useState, useTransition } from "react";
import { saveLanguage, criticPreview } from "./actions";
import { AdPreviewPreview } from "@/components/ad-preview";

const SLIDERS: Array<{ key: keyof BrandLanguage["toneSliders"]; left: string; right: string }> = [
  { key: "formal_casual", left: "Formal", right: "Casual" },
  { key: "serious_playful", left: "Serious", right: "Playful" },
  { key: "reserved_bold", left: "Reserved", right: "Bold" },
  { key: "classic_modern", left: "Classic", right: "Modern" },
];

export function LanguageEditor({ brand }: { brand: Brand }) {
  const [lang, setLang] = useState<BrandLanguage>(brand.language);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  const [draft, setDraft] = useState({ pref: "", ban: "", sentence: "", do_: "", dont: "" });
  const [criticResult, setCriticResult] = useState<{ score: number; voiceFit: number; formatFit: number; conceptStrength: number; verdict: string; notes: string[] } | null>(null);

  function patch<K extends keyof BrandLanguage>(k: K, v: BrandLanguage[K]) {
    setLang({ ...lang, [k]: v });
  }
  function patchSlider(k: keyof BrandLanguage["toneSliders"], v: number) {
    setLang({ ...lang, toneSliders: { ...lang.toneSliders, [k]: v } });
  }
  function addTo(list: keyof Pick<BrandLanguage, "preferredWords" | "bannedWords" | "sampleSentences" | "doRules" | "doNotRules">, value: string, draftKey: keyof typeof draft) {
    const v = value.trim();
    if (!v) return;
    patch(list, [...lang[list], v] as any);
    setDraft({ ...draft, [draftKey]: "" });
  }
  function removeFrom(list: keyof Pick<BrandLanguage, "preferredWords" | "bannedWords" | "sampleSentences" | "doRules" | "doNotRules">, idx: number) {
    const next = [...lang[list]];
    next.splice(idx, 1);
    patch(list, next as any);
  }

  function onSave() {
    setError(null);
    start(async () => {
      try {
        await saveLanguage(brand.id, lang);
        setSaved(true);
        setBump((v) => v + 1);
        setTimeout(() => setSaved(false), 1500);
      } catch (e: any) { setError(e?.message || "Save failed"); }
    });
  }

  async function runCritic(headline: string, subhead: string, cta: string) {
    setError(null);
    start(async () => {
      try {
        const r = await criticPreview(brand.id, lang, { headline, subhead, cta, eyebrow: "FIELD-TESTED" }, "meta-feed-4x5");
        setCriticResult(r);
      } catch (e: any) { setError(e?.message || "Critic failed"); }
    });
  }

  const previewHeadline = lang.sampleSentences[0] || `${brand.name}.\nQuietly correct.`;
  const previewSubhead = lang.sampleSentences[1] || "Made for the way you live, not the way the category sells.";

  return (
    <div className="grid lg:grid-cols-[1fr,420px] gap-6">
      <div className="space-y-6">
        <Card className="p-6">
          <Eyebrow>Voice description</Eyebrow>
          <TextArea
            className="mt-3"
            rows={4}
            value={lang.voiceDescription}
            onChange={(e) => patch("voiceDescription", e.target.value)}
            placeholder="A short paragraph describing how the brand sounds — register, rhythm, what it would never say."
          />
        </Card>

        <Card className="p-6 space-y-4">
          <Eyebrow>Tone</Eyebrow>
          {SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex items-center justify-between text-xs text-ink-300">
                <span>{s.left}</span>
                <span className="text-ink-500">{lang.toneSliders[s.key].toFixed(2)}</span>
                <span>{s.right}</span>
              </div>
              <input
                type="range" min="-1" max="1" step="0.05"
                value={lang.toneSliders[s.key]}
                onChange={(e) => patchSlider(s.key, parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          ))}
        </Card>

        <Card className="p-6 space-y-3">
          <Eyebrow>Lexicon</Eyebrow>
          <div className="grid md:grid-cols-2 gap-4">
            <Listy
              title="Preferred words"
              hint="Lines that use these get promoted by the Copywriter."
              items={lang.preferredWords}
              draft={draft.pref}
              setDraft={(v) => setDraft({ ...draft, pref: v })}
              onAdd={() => addTo("preferredWords", draft.pref, "pref")}
              onRemove={(i) => removeFrom("preferredWords", i)}
              tone="ok"
              placeholder="e.g. quiet, considered, made"
            />
            <Listy
              title="Banned words"
              hint="Filtered out of every generation. Critic flags any violations."
              items={lang.bannedWords}
              draft={draft.ban}
              setDraft={(v) => setDraft({ ...draft, ban: v })}
              onAdd={() => addTo("bannedWords", draft.ban, "ban")}
              onRemove={(i) => removeFrom("bannedWords", i)}
              tone="danger"
              placeholder="e.g. unleash, game-changing, hustle"
            />
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <Eyebrow>Do / Don't</Eyebrow>
          <div className="grid md:grid-cols-2 gap-4">
            <Listy
              title="Do"
              hint="Behaviors copy should embody."
              items={lang.doRules}
              draft={draft.do_}
              setDraft={(v) => setDraft({ ...draft, do_: v })}
              onAdd={() => addTo("doRules", draft.do_, "do_")}
              onRemove={(i) => removeFrom("doRules", i)}
              tone="ok"
              placeholder="e.g. lead with the benefit"
            />
            <Listy
              title="Don't"
              hint="Behaviors to avoid."
              items={lang.doNotRules}
              draft={draft.dont}
              setDraft={(v) => setDraft({ ...draft, dont: v })}
              onAdd={() => addTo("doNotRules", draft.dont, "dont")}
              onRemove={(i) => removeFrom("doNotRules", i)}
              tone="danger"
              placeholder="e.g. exclamation marks"
            />
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <Eyebrow>Character limits</Eyebrow>
          <div className="text-xs text-ink-400">Hard caps the Copywriter agent honors. Surfaces as live counters in Copy Lab and the edit panel.</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {(["headlineMaxChars", "subheadMaxChars", "ctaMaxChars", "eyebrowMaxChars"] as const).map((k) => (
              <div key={k} className="space-y-1">
                <Label>{k.replace("MaxChars", "")} max</Label>
                <Input
                  type="number"
                  value={lang.copyLimits[k]}
                  onChange={(e) => {
                    const v = parseInt(e.target.value || "0", 10);
                    setLang({ ...lang, copyLimits: { ...lang.copyLimits, [k]: isNaN(v) ? lang.copyLimits[k] : v } });
                  }}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <Eyebrow>Sample sentences</Eyebrow>
          <div className="text-xs text-ink-400">Lines that sound right. The preview pulls the first two — also pinned for the QC Critic's reference.</div>
          <Listy
            title=""
            hint=""
            items={lang.sampleSentences}
            draft={draft.sentence}
            setDraft={(v) => setDraft({ ...draft, sentence: v })}
            onAdd={() => addTo("sampleSentences", draft.sentence, "sentence")}
            onRemove={(i) => removeFrom("sampleSentences", i)}
            tone="neutral"
            placeholder="An example line in this brand's voice."
            stacked
          />
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={onSave} disabled={pending}>{pending ? "Saving…" : "Save language"}</Button>
          {saved && <span className="text-xs text-emerald-300">Saved — agents will use this immediately.</span>}
          {error && <span className="text-xs text-rose-300">{error}</span>}
        </div>
      </div>

      <div className="space-y-4">
        <Card className="p-4 sticky top-6">
          <Eyebrow>Live preview · 4:5 feed</Eyebrow>
          <div className="mt-3">
            <AdPreviewPreview
              key={bump + "-pv"}
              brandId={brand.id}
              formatSlug="meta-feed-4x5"
              copy={{
                eyebrow: "FIELD-TESTED",
                headline: previewHeadline,
                subhead: previewSubhead,
                cta: "Shop the season",
              }}
            />
          </div>
          <div className="pt-3 border-t border-white/5 mt-4 space-y-2">
            <Eyebrow>Ask the Critic</Eyebrow>
            <Button size="sm" variant="ghost" onClick={() => runCritic(previewHeadline, previewSubhead, "Shop the season")}>
              Critique this preview →
            </Button>
            {criticResult && (
              <div className="mt-2 rounded-lg ring-1 ring-white/5 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-300">{criticResult.verdict.toUpperCase()}</span>
                  <span className="text-ink-100">{Math.round(criticResult.score * 100)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-ink-400">
                  <div>voice {Math.round(criticResult.voiceFit * 100)}</div>
                  <div>format {Math.round(criticResult.formatFit * 100)}</div>
                  <div>concept {Math.round(criticResult.conceptStrength * 100)}</div>
                </div>
                {criticResult.notes.length > 0 && (
                  <ul className="text-[11px] text-ink-300 mt-2 space-y-0.5">
                    {criticResult.notes.slice(0, 4).map((n, i) => <li key={i}>· {n}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
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
  return (
    <div className="space-y-2">
      {title && <div className="text-sm text-ink-100">{title}</div>}
      {hint && <div className="text-[11px] text-ink-400">{hint}</div>}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          placeholder={placeholder}
        />
        <Button size="sm" variant="secondary" onClick={onAdd}>Add</Button>
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-ink-500">— empty —</div>
      ) : stacked ? (
        <ul className="space-y-1.5">
          {items.map((s, i) => (
            <li key={i} className={"rounded-md px-3 py-1.5 text-sm ring-1 flex items-center justify-between " + colorMap[tone]}>
              <span>{s}</span>
              <button onClick={() => onRemove(i)} className="text-[11px] text-ink-300 hover:text-white">✕</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((s, i) => (
            <span key={i} className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ring-1 " + colorMap[tone]}>
              {s}
              <button onClick={() => onRemove(i)} className="text-ink-300 hover:text-white">✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
