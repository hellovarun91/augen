"use client";
import { Badge, Button, Card, Eyebrow, Input, Label, TextArea } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import type { CopySchema, CopyColumn } from "@/lib/copy-schema";
import { inferSchemaAction, saveSchemaAction } from "./actions";

const ROLES: CopyColumn["role"][] = ["headline", "subhead", "cta", "eyebrow", "offer", "body", "image", "url", "custom"];
const LAYERS: CopyColumn["layer"][] = ["headline", "subhead", "cta", "eyebrow", "none"];

export function CopySchemaEditor({ brandId, slug, initial }: { brandId: string; slug: string; initial: CopySchema }) {
  const [columns, setColumns] = useState<CopyColumn[]>(initial.columns);
  const [regions, setRegions] = useState<string[]>(initial.regions);
  const [regionDraft, setRegionDraft] = useState("");
  const [doc, setDoc] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function patchCol(i: number, patch: Partial<CopyColumn>) {
    setColumns((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function addCol() {
    setColumns((c) => [...c, { key: `field_${c.length + 1}`, label: "New field", role: "custom", layer: "none", perRegion: false }]);
  }
  function removeCol(i: number) { setColumns((c) => c.filter((_, j) => j !== i)); }
  function move(i: number, dir: -1 | 1) {
    setColumns((c) => { const n = [...c]; const j = i + dir; if (j < 0 || j >= n.length) return c; [n[i], n[j]] = [n[j], n[i]]; return n; });
  }

  function infer() {
    setError(null); setNote(null);
    start(async () => {
      try {
        const r = await inferSchemaAction(brandId, doc);
        setColumns(r.schema.columns);
        setRegions(r.schema.regions);
        setNote(`${r.provider === "claude" ? "Claude read your doc" : "Parsed your doc"} — ${r.rationale} Review and save.`);
      } catch (e: any) { setError(e?.message || "Could not read the doc"); }
    });
  }
  function save() {
    setError(null);
    start(async () => {
      try {
        await saveSchemaAction(brandId, slug, { columns, regions });
        setSaved(true); setTimeout(() => setSaved(false), 2000);
      } catch (e: any) { setError(e?.message || "Save failed"); }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-3">
        <Eyebrow>Import from your copy doc</Eyebrow>
        <div className="text-xs text-ink-400">Paste the doc your team keeps — labelled fields like CTA, Headline, regional Offer, Image copy, Emailer subject. Augen reads the structure into columns you can edit.</div>
        <TextArea rows={6} value={doc} onChange={(e) => setDoc(e.target.value)} placeholder={"Headline: Learn without limits\nSubhead: 7,000+ courses from top universities\nCTA: Start for free\nOffer (India): ₹499/month for the first 3 months\nImage copy: Certificates that count"} />
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={infer} disabled={pending || !doc.trim()}>{pending ? "Reading…" : "Infer columns"}</Button>
          {note && <span className="text-xs text-emerald-300">{note}</span>}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Eyebrow>Columns</Eyebrow>
          <Button size="sm" variant="ghost" onClick={addCol}>+ Add column</Button>
        </div>
        <div className="space-y-2">
          {columns.map((col, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center rounded-lg ring-1 ring-white/10 p-2">
              <Input className="col-span-3 text-sm" value={col.label} onChange={(e) => patchCol(i, { label: e.target.value })} placeholder="Label" />
              <select className="col-span-2 rounded-lg bg-ink-800 px-2 py-2 text-xs ring-1 ring-inset ring-white/10" value={col.role} onChange={(e) => patchCol(i, { role: e.target.value as any })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select className="col-span-2 rounded-lg bg-ink-800 px-2 py-2 text-xs ring-1 ring-inset ring-white/10" value={col.layer} onChange={(e) => patchCol(i, { layer: e.target.value as any })} title="Which on-creative slot this feeds">
                {LAYERS.map((l) => <option key={l} value={l}>{l === "none" ? "no layer" : l}</option>)}
              </select>
              <Input className="col-span-2 text-sm" type="number" value={col.maxChars ?? ""} onChange={(e) => patchCol(i, { maxChars: e.target.value ? parseInt(e.target.value, 10) : undefined })} placeholder="max" />
              <label className="col-span-2 flex items-center gap-1.5 text-[11px] text-ink-300">
                <input type="checkbox" checked={col.perRegion} onChange={(e) => patchCol(i, { perRegion: e.target.checked })} /> per region
              </label>
              <div className="col-span-1 flex items-center justify-end gap-1 text-ink-500">
                <button onClick={() => move(i, -1)} className="hover:text-ink-100" title="Up">↑</button>
                <button onClick={() => move(i, 1)} className="hover:text-ink-100" title="Down">↓</button>
                <button onClick={() => removeCol(i)} className="hover:text-rose-300" title="Remove">✕</button>
              </div>
            </div>
          ))}
          {columns.length === 0 && <div className="text-xs text-ink-500">No columns yet — import a doc or add one.</div>}
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <Eyebrow>Regions <span className="text-ink-500">(optional)</span></Eyebrow>
        <div className="text-xs text-ink-400">Markets you localize copy for. Columns marked “per region” get a value per region in the sheet.</div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg ring-1 ring-white/10 bg-ink-900/40 px-2 py-1.5">
          {regions.map((r, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-white/10 bg-white/5">
              {r}<button onClick={() => setRegions(regions.filter((_, j) => j !== i))} className="text-ink-400 hover:text-white">×</button>
            </span>
          ))}
          <input value={regionDraft} onChange={(e) => setRegionDraft(e.target.value)}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === ",") && regionDraft.trim()) { e.preventDefault(); setRegions([...regions, regionDraft.trim()]); setRegionDraft(""); } }}
            placeholder={regions.length ? "Add…" : "e.g. US, India, UK"} className="flex-1 min-w-[90px] bg-transparent text-sm px-1 py-0.5 outline-none placeholder:text-ink-500" />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save copy structure"}</Button>
        {saved && <span className="text-xs text-emerald-300">Saved ✓</span>}
        {error && <span className="text-xs text-rose-300">{error}</span>}
      </div>
    </div>
  );
}
