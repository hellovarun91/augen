"use client";
import { Button, Eyebrow, Input, Label, TextArea } from "@/components/ui/primitives";
import { useMemo, useState, useTransition } from "react";
import { createMatrixBatchAction } from "./actions";
import type { FormatSpec } from "@/lib/formats";

type Slot = "headline" | "subhead" | "cta" | "eyebrow" | "image";

export function MatrixEditor({
  campaignId,
  ideaId,
  references,
  groupedFormats,
  defaultFormats,
}: {
  campaignId: string;
  ideaId: string;
  references: Array<{ id: string; label: string; filePath: string | null }>;
  groupedFormats: Record<string, FormatSpec[]>;
  defaultFormats: string[];
}) {
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState<"cross" | "zip">("cross");
  const [headlines, setHeadlines] = useState<string[]>([""]);
  const [subheads, setSubheads] = useState<string[]>([""]);
  const [ctas, setCtas] = useState<string[]>([""]);
  const [eyebrows, setEyebrows] = useState<string[]>([""]);
  const [images, setImages] = useState<string[]>([""]); // ref ids, "" = no image (SVG bg)
  const [formats, setFormats] = useState<Set<string>>(new Set(defaultFormats.slice(0, 2)));
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function clean(arr: string[]) {
    return arr.map((s) => s.trim()).filter(Boolean);
  }
  function imagesClean() {
    return images.map((s) => s.trim()); // keep empty strings — they mean "no image"
  }

  const counts = useMemo(() => {
    const H = clean(headlines).length || 1;
    const S = clean(subheads).length || 1;
    const C = clean(ctas).length || 1;
    const E = clean(eyebrows).length || 1;
    const I = imagesClean().filter(Boolean).length + (imagesClean().some((s) => s === "") ? 1 : 0) || 1;
    const combos = strategy === "cross" ? H * S * C * E * I : Math.max(H, S, C, E, I);
    return { combos, totalAds: combos * formats.size };
  }, [headlines, subheads, ctas, eyebrows, images, strategy, formats]);

  function toggleFormat(slug: string) {
    const next = new Set(formats);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    setFormats(next);
  }

  function submit() {
    setError(null); setInfo(null);
    start(async () => {
      try {
        const slots = {
          headline: clean(headlines),
          subhead: clean(subheads),
          cta: clean(ctas),
          eyebrow: clean(eyebrows),
          imageRefIds: imagesClean().map((s) => s ? s : null) as (string | null)[],
        };
        const r = await createMatrixBatchAction(campaignId, ideaId, {
          name: name.trim() || `Variations ${new Date().toISOString().slice(0, 16)}`,
          strategy,
          slots,
          formats: Array.from(formats),
        });
        setInfo(`Generated ${r.generationsCount} ads from ${r.combos} combinations.`);
      } catch (e: any) {
        setError(e?.message || "Generation failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Batch name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q2 CTA test" />
        </div>
        <div className="space-y-1.5">
          <Label>Strategy</Label>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as "cross" | "zip")} className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm ring-1 ring-inset ring-white/10">
            <option value="cross">Cross-product (every combination)</option>
            <option value="zip">Zipped (row-by-row, paired)</option>
          </select>
        </div>
      </div>

      <SlotList label="Headlines" items={headlines} setItems={setHeadlines} placeholder="Begin with Tanda." multiline />
      <SlotList label="Subheads" items={subheads} setItems={setSubheads} placeholder="Wild fermented. Low sugar." />
      <SlotList label="CTAs" items={ctas} setItems={setCtas} placeholder="Find a store" />
      <SlotList label="Eyebrows" items={eyebrows} setItems={setEyebrows} placeholder="FIELD-TESTED" />
      <ImageSlotList items={images} setItems={setImages} references={references} />

      <div className="space-y-2">
        <Eyebrow>Formats</Eyebrow>
        {Object.entries(groupedFormats).slice(0, 3).map(([platform, list]) => (
          <div key={platform}>
            <div className="text-xs text-ink-300 mb-1">{platform}</div>
            <div className="flex flex-wrap gap-1.5">
              {list.map((f) => {
                const on = formats.has(f.slug);
                return (
                  <button
                    key={f.slug}
                    onClick={() => toggleFormat(f.slug)}
                    className={"text-[11px] rounded-full px-2.5 py-1 ring-1 transition-colors " + (on ? "bg-ink-50 text-ink-950 ring-ink-50" : "bg-ink-800 text-ink-200 ring-white/10 hover:bg-ink-700")}
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
        <div className="text-xs text-ink-300">
          <span className="text-ink-100">{counts.combos}</span> combinations × {formats.size} formats
          {" = "}<span className={counts.totalAds > 200 ? "text-rose-300" : "text-emerald-300"}>{counts.totalAds} ads</span>
          <span className="text-ink-500"> (cap 200)</span>
        </div>
        <Button onClick={submit} disabled={pending || counts.totalAds === 0 || counts.totalAds > 200}>
          {pending ? "Generating…" : `Generate ${counts.totalAds} ads (free)`}
        </Button>
      </div>
      {info && <div className="text-xs text-emerald-300">{info}</div>}
      {error && <div className="text-xs text-rose-300">{error}</div>}
    </div>
  );
}

function SlotList({
  label, items, setItems, placeholder, multiline = false,
}: {
  label: string; items: string[]; setItems: (s: string[]) => void; placeholder: string; multiline?: boolean;
}) {
  function update(i: number, v: string) { const c = [...items]; c[i] = v; setItems(c); }
  function add() { setItems([...items, ""]); }
  function remove(i: number) { const c = [...items]; c.splice(i, 1); setItems(c.length ? c : [""]); }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="space-y-1.5">
        {items.map((v, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="text-[10px] text-ink-500 w-5 mt-2">{i + 1}</div>
            {multiline ? (
              <TextArea value={v} onChange={(e) => update(i, e.target.value)} placeholder={placeholder} rows={2} className="flex-1" />
            ) : (
              <Input value={v} onChange={(e) => update(i, e.target.value)} placeholder={placeholder} className="flex-1" />
            )}
            <button onClick={() => remove(i)} className="text-[11px] text-ink-400 hover:text-rose-300 mt-2">✕</button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-[11px] text-ink-300 hover:text-ink-100">+ add</button>
    </div>
  );
}

function ImageSlotList({
  items, setItems, references,
}: {
  items: string[]; setItems: (s: string[]) => void; references: Array<{ id: string; label: string; filePath: string | null }>;
}) {
  function update(i: number, v: string) { const c = [...items]; c[i] = v; setItems(c); }
  function add() { setItems([...items, ""]); }
  function remove(i: number) { const c = [...items]; c.splice(i, 1); setItems(c.length ? c : [""]); }
  return (
    <div className="space-y-1.5">
      <Label>Images (leave blank for SVG background)</Label>
      <div className="space-y-1.5">
        {items.map((v, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="text-[10px] text-ink-500 w-5 mt-2">{i + 1}</div>
            <select
              value={v}
              onChange={(e) => update(i, e.target.value)}
              className="flex-1 rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10"
            >
              <option value="">— SVG background (no image) —</option>
              {references.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
            <button onClick={() => remove(i)} className="text-[11px] text-ink-400 hover:text-rose-300 mt-2">✕</button>
          </div>
        ))}
      </div>
      <button onClick={add} className="text-[11px] text-ink-300 hover:text-ink-100">+ add</button>
    </div>
  );
}
