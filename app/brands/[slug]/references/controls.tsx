"use client";
import { Button, Input, Label } from "@/components/ui/primitives";
import { useRef, useState, useTransition } from "react";
import { uploadRefAction, stockSearchAction, generateRefAction, deleteRefAction, toggleSelectedAction } from "./actions";

export function UploadRef({ brandId }: { brandId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2 mt-2"
      action={(fd) => start(async () => {
        setError(null);
        try { await uploadRefAction(brandId, fd); ref.current && (ref.current.value = ""); }
        catch (e: any) { setError(e?.message || "Upload failed"); }
      })}
    >
      <input ref={ref} name="file" type="file" accept="image/*" required className="block w-full text-xs text-ink-200 file:mr-3 file:rounded-full file:border-0 file:bg-ink-700 file:text-ink-50 file:text-xs file:px-3 file:py-1.5 hover:file:bg-ink-600" />
      <Input name="label" placeholder="Label (e.g. golden hour pour)" />
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Uploading…" : "Upload reference"}</Button>
      {error && <div className="text-[11px] text-rose-300">{error}</div>}
    </form>
  );
}

export function StockSearchForm({ brandId, disabled }: { brandId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2 mt-2"
      action={(fd) => start(async () => {
        setError(null);
        try { await stockSearchAction(brandId, fd); }
        catch (e: any) { setError(e?.message || "Search failed"); }
      })}
    >
      <Input name="query" placeholder="Search Pexels (e.g. soft window pour-over)" required disabled={disabled} />
      <div className="grid grid-cols-2 gap-2">
        <select name="orientation" defaultValue="landscape" disabled={disabled} className="w-full rounded-lg bg-ink-800 px-2 py-1.5 text-xs ring-1 ring-inset ring-white/10">
          <option value="landscape">Landscape</option>
          <option value="portrait">Portrait</option>
          <option value="square">Square</option>
        </select>
        <Input name="label" placeholder="Save as label (optional)" disabled={disabled} />
      </div>
      <Button type="submit" size="sm" disabled={pending || disabled}>{pending ? "Searching…" : "Pull from stock"}</Button>
      {error && <div className="text-[11px] text-rose-300">{error}</div>}
    </form>
  );
}

export function GenerateForm({ brandId, brandSlug, disabled }: { brandId: string; brandSlug: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2 mt-2"
      action={(fd) => start(async () => {
        setError(null);
        try { await generateRefAction(brandId, brandSlug, fd); }
        catch (e: any) { setError(e?.message || "Generation failed"); }
      })}
    >
      <Input name="prompt" placeholder="Describe a brand reference (subject + light)" required disabled={disabled} />
      <select name="aspect" defaultValue="4:5" disabled={disabled} className="w-full rounded-lg bg-ink-800 px-2 py-1.5 text-xs ring-1 ring-inset ring-white/10">
        <option value="1:1">Square 1:1</option>
        <option value="4:5">Portrait 4:5</option>
        <option value="9:16">Story 9:16</option>
        <option value="1.91:1">Wide 1.91:1</option>
      </select>
      <Button type="submit" size="sm" disabled={pending || disabled}>{pending ? "Generating…" : "Generate (Gemini)"}</Button>
      {error && <div className="text-[11px] text-rose-300">{error}</div>}
    </form>
  );
}

export function ToggleSelectedButton({ refId, selected }: { refId: string; selected: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await toggleSelectedAction(refId, !selected); })}
      disabled={pending}
      className={"text-[10px] rounded-full px-2 py-0.5 ring-1 " + (selected ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30" : "bg-white/5 text-ink-300 ring-white/10")}
    >
      {selected ? "in pool" : "off"}
    </button>
  );
}

export function DeleteRefButton({ refId }: { refId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await deleteRefAction(refId); })}
      disabled={pending}
      className="text-[10px] text-ink-400 hover:text-rose-300"
    >
      delete
    </button>
  );
}
