"use client";
import { useState, useRef, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/primitives";
import { setRowImageAction, uploadRowImageAction } from "./actions";

export interface ReferenceLite { id: string; label: string | null; file_path: string | null; mime: string | null; kind: string }

// The image-cell: shows a thumbnail when set, opens a picker (Library / Upload)
// when clicked. Persists via setRowImageAction / uploadRowImageAction — both
// trigger the #49 stale rule so the row's designs go amber until re-rendered.
export function MediaCell({ campaignId, rowId, columnKey, value, references, onChange }: {
  campaignId: string; rowId: string; columnKey: string;
  value: string; // a Reference id, or ""
  references: ReferenceLite[];
  onChange: (v: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const current = value ? references.find((r) => r.id === value) : null;

  function pick(refId: string | null) {
    setErr(null);
    onChange(refId || "");
    setOpen(false);
    start(async () => {
      try { await setRowImageAction(campaignId, rowId, columnKey, refId); }
      catch (e: any) { setErr(e?.message || "Couldn't set image"); }
    });
  }

  function onUpload(fd: FormData) {
    setErr(null);
    start(async () => {
      try {
        const res = await uploadRowImageAction(campaignId, rowId, columnKey, fd);
        onChange(res.refId);
        setOpen(false);
      } catch (e: any) { setErr(e?.message || "Upload failed"); }
    });
  }

  return (
    <div ref={boxRef} className="relative">
      {current && current.file_path ? (
        <div className="group relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.file_path} alt={current.label || "image"} className="block w-full h-20 object-cover rounded-md ring-1 ring-white/10" />
          <div className="absolute inset-0 rounded-md bg-ink-950/0 group-hover:bg-ink-950/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
            <button onClick={() => { setTab("library"); setOpen(true); }} className="text-[11px] rounded-full px-2 py-0.5 bg-white/10 text-ink-100 ring-1 ring-white/20 hover:bg-white/15">Change</button>
            <button onClick={() => pick(null)} className="text-[11px] rounded-full px-2 py-0.5 bg-rose-400/15 text-rose-100 ring-1 ring-rose-400/30 hover:bg-rose-400/25">Clear</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setTab("library"); setOpen(true); }}
          className="w-full h-20 rounded-md ring-1 ring-dashed ring-white/15 bg-ink-900/40 text-[11px] text-ink-400 hover:ring-white/30 hover:text-ink-200">
          + Set image
        </button>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 rounded-lg ring-1 ring-white/10 bg-ink-900 shadow-2xl w-[280px]">
          <div className="flex border-b border-white/5">
            {(["library", "upload"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={"flex-1 text-xs py-2 transition-colors " + (tab === t ? "text-ink-100 bg-white/5" : "text-ink-400 hover:text-ink-200")}>
                {t === "library" ? "Library" : "Upload"}
              </button>
            ))}
          </div>

          {tab === "library" ? (
            <div className="p-2 max-h-64 overflow-y-auto">
              {references.length === 0 ? (
                <div className="text-[11px] text-ink-500 px-2 py-6 text-center">No brand assets yet — upload one, or add Pexels references on the brand.</div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {references.map((r) => (
                    <button key={r.id} onClick={() => pick(r.id)} disabled={pending}
                      title={r.label || r.kind}
                      className={"block aspect-square rounded-md ring-1 overflow-hidden transition-shadow " + (r.id === value ? "ring-emerald-400/50" : "ring-white/10 hover:ring-white/30")}>
                      {r.file_path
                        ? /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={r.file_path} alt={r.label || ""} className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-ink-800" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form className="p-3 space-y-2" action={(fd) => onUpload(fd)}>
              <input name="file" type="file" accept="image/*" required
                className="block w-full text-[11px] text-ink-300 file:mr-2 file:rounded-full file:border-0 file:bg-ink-700 file:text-ink-50 file:text-[11px] file:px-3 file:py-1 hover:file:bg-ink-600" />
              <div className="flex items-center gap-2">
                <Button size="sm" type="submit" disabled={pending}>{pending ? "Uploading…" : "Upload"}</Button>
                <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-ink-400 hover:text-white">Cancel</button>
              </div>
            </form>
          )}

          {err && <div className="px-3 py-2 text-[10px] text-rose-300 border-t border-white/5">{err}</div>}
        </div>
      )}
    </div>
  );
}
