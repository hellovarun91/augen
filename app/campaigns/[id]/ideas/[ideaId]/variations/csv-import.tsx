"use client";
import { Button, Card, Eyebrow, Input, Label, TextArea } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { createCsvBatchAction } from "./actions";
import type { FormatSpec } from "@/lib/formats";

export function CsvImport({
  campaignId, ideaId, groupedFormats, defaultFormats,
}: {
  campaignId: string; ideaId: string;
  groupedFormats: Record<string, FormatSpec[]>; defaultFormats: string[];
}) {
  const [paste, setPaste] = useState("");
  const [name, setName] = useState("");
  const [formats, setFormats] = useState<Set<string>>(new Set(defaultFormats.slice(0, 2)));
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleFormat(slug: string) {
    const next = new Set(formats);
    if (next.has(slug)) next.delete(slug); else next.add(slug);
    setFormats(next);
  }

  function submit() {
    setError(null); setInfo(null);
    start(async () => {
      try {
        const r = await createCsvBatchAction(campaignId, ideaId, {
          name: name.trim() || `CSV ${new Date().toISOString().slice(0, 16)}`,
          csv: paste,
          formats: Array.from(formats),
        });
        setInfo(`Imported ${r.combos} rows → ${r.generationsCount} ads.`);
      } catch (e: any) {
        setError(e?.message || "Import failed");
      }
    });
  }

  return (
    <Card className="p-5 space-y-3">
      <Eyebrow>CSV import</Eyebrow>
      <div className="space-y-1.5">
        <Label>Batch name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sheet import — Aug 2026" />
      </div>
      <div className="space-y-1.5">
        <Label>CSV (header row + data)</Label>
        <TextArea
          rows={10}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={`headline,subhead,cta,eyebrow,image_ref_id\n"Begin with Tanda.","Wild fermented.","Find a store","FIELD-TESTED",`}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Formats to render</Label>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(groupedFormats).flat().slice(0, 8).map((f) => {
            const on = formats.has(f.slug);
            return (
              <button
                key={f.slug}
                onClick={() => toggleFormat(f.slug)}
                className={"text-[10px] rounded-full px-2.5 py-1 ring-1 " + (on ? "bg-ink-50 text-ink-950 ring-ink-50" : "bg-ink-800 text-ink-200 ring-white/10")}
              >
                {f.name}
              </button>
            );
          })}
        </div>
      </div>

      <Button onClick={submit} disabled={pending || !paste || !formats.size}>
        {pending ? "Importing…" : "Import & render (free)"}
      </Button>
      {info && <div className="text-xs text-emerald-300">{info}</div>}
      {error && <div className="text-xs text-rose-300">{error}</div>}
    </Card>
  );
}
