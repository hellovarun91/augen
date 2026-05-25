"use client";
import { Eyebrow, Input } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { deleteBrandAction } from "./actions";

export function DeleteBrand({ brandId, name }: { brandId: string; name: string }) {
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function del() {
    setErr(null);
    start(async () => {
      try { await deleteBrandAction(brandId); }
      catch (e: any) { if (!e?.digest?.startsWith?.("NEXT_REDIRECT")) setErr(e?.message || "Could not delete"); }
    });
  }

  return (
    <div className="rounded-xl ring-1 ring-rose-500/20 bg-rose-500/[0.04] p-5 space-y-3">
      <div>
        <Eyebrow className="!text-rose-300">Danger zone</Eyebrow>
        <p className="text-sm text-ink-300 mt-1">
          Permanently delete <span className="text-ink-100">{name}</span> and everything under it — projects, creatives,
          assets, references, copy, winners. This can't be undone.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Type "${name}" to confirm`} className="flex-1" />
        <button
          onClick={del}
          disabled={pending || confirm !== name}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-rose-500/90 text-white hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {pending ? "Deleting…" : "Delete brand"}
        </button>
      </div>
      {err && <div className="text-xs text-rose-300">{err}</div>}
    </div>
  );
}
