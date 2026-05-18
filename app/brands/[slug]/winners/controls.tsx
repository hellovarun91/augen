"use client";
import { Button, Input, Label, TextArea } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { addWinnerAction, importCsvAction, deleteWinnerAction } from "./actions";

export function AddWinnerForm({ brandId, brandSlug }: { brandId: string; brandSlug: string }) {
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3 mt-3"
      action={(fd) => start(async () => {
        setError(null); setInfo(null);
        try { await addWinnerAction(brandId, brandSlug, fd); setInfo("Saved. Visible in the next agent call."); }
        catch (e: any) { setError(e?.message || "Save failed"); }
      })}
    >
      <div className="space-y-1.5">
        <Label>Headline (use linebreaks for stacking)</Label>
        <TextArea name="headline" rows={3} required placeholder="Begin with Tanda." />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Subhead</Label>
          <Input name="subhead" placeholder="Wild fermented. Low sugar." />
        </div>
        <div className="space-y-1.5">
          <Label>CTA</Label>
          <Input name="cta" placeholder="Find a store" />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Eyebrow</Label>
          <Input name="eyebrow" placeholder="FIELD-TESTED" />
        </div>
        <div className="space-y-1.5">
          <Label>Format slug (optional)</Label>
          <Input name="format_slug" placeholder="meta-feed-4x5" />
        </div>
        <div className="space-y-1.5">
          <Label>Source</Label>
          <select name="source" defaultValue="manual" className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm ring-1 ring-inset ring-white/10">
            <option value="manual">Manual</option>
            <option value="google_ads">Google Ads</option>
            <option value="meta_ads">Meta Ads</option>
            <option value="past">Past campaign</option>
          </select>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Metric tag (e.g. "ROAS 4.1x")</Label>
          <Input name="metric_label" placeholder="ROAS 4.1x" />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input name="notes" placeholder="Top performer Q2" />
        </div>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add winner →"}</Button>
      {info && <div className="text-xs text-emerald-300">{info}</div>}
      {error && <div className="text-xs text-rose-300">{error}</div>}
    </form>
  );
}

export function CsvImportForm({ brandId, brandSlug }: { brandId: string; brandSlug: string }) {
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3 mt-3"
      action={(fd) => start(async () => {
        setError(null); setInfo(null);
        try {
          const r = await importCsvAction(brandId, brandSlug, fd);
          setInfo(`Imported ${r.added} winner${r.added === 1 ? "" : "s"}.`);
        } catch (e: any) { setError(e?.message || "Import failed"); }
      })}
    >
      <div className="space-y-1.5">
        <Label>CSV file</Label>
        <input type="file" name="file" accept=".csv,text/csv" className="block w-full text-xs text-ink-200 file:mr-3 file:rounded-full file:border-0 file:bg-ink-700 file:text-ink-50 file:text-xs file:px-3 file:py-1.5 hover:file:bg-ink-600" />
      </div>
      <div className="text-xs text-ink-400">Or paste rows directly below:</div>
      <TextArea name="paste" rows={6} placeholder='headline,subhead,cta,eyebrow,format_slug,source,metric_label,notes&#10;"Begin with Tanda.","Wild fermented.","Find a store","JUST IN","meta-feed-4x5","meta_ads","ROAS 4.1x",""' />
      <Button type="submit" disabled={pending}>{pending ? "Importing…" : "Import →"}</Button>
      {info && <div className="text-xs text-emerald-300">{info}</div>}
      {error && <div className="text-xs text-rose-300">{error}</div>}
    </form>
  );
}

export function WinnerRowControls({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await deleteWinnerAction(id); })}
      disabled={pending}
      className="text-[11px] text-ink-400 hover:text-rose-300"
    >
      delete
    </button>
  );
}
