"use client";
import { Badge, Button, Card, Eyebrow, Input, Label } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import type { BrandAsset, AssetKind } from "@/lib/repo";
import { uploadAssetAction, deleteAssetAction, setAssetRoleAction } from "./actions";

const KINDS: Array<{ key: AssetKind; label: string }> = [
  { key: "logo", label: "Logo" },
  { key: "mark", label: "Logo mark" },
  { key: "icon", label: "Icon" },
  { key: "badge", label: "Badge" },
  { key: "graphic", label: "Graphic" },
];

// Transparency checkerboard so both light and dark assets read on the dark UI.
const CHECKER: React.CSSProperties = {
  backgroundColor: "#2c2c30",
  backgroundImage:
    "linear-gradient(45deg,#1f1f23 25%,transparent 25%),linear-gradient(-45deg,#1f1f23 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1f1f23 75%),linear-gradient(-45deg,transparent 75%,#1f1f23 75%)",
  backgroundSize: "14px 14px",
  backgroundPosition: "0 0,0 7px,7px -7px,-7px 0",
};

export function AssetManager({ brandId, slug, assets }: { brandId: string; slug: string; assets: BrandAsset[] }) {
  const [kind, setKind] = useState<AssetKind>("logo");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(fd: FormData) {
    setError(null);
    fd.set("kind", kind);
    fd.set("label", label);
    start(async () => {
      try { await uploadAssetAction(brandId, fd); setLabel(""); }
      catch (e: any) { setError(e?.message || "Upload failed"); }
    });
  }
  function act(fn: () => Promise<void>) { start(async () => { try { await fn(); } catch (e: any) { setError(e?.message || "Failed"); } }); }

  const byKind = KINDS.map((k) => ({ ...k, items: assets.filter((a) => a.kind === k.key) })).filter((g) => g.items.length);

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <Eyebrow>Upload an asset</Eyebrow>
        <form action={onSubmit} className="mt-3 grid md:grid-cols-[1fr,160px,auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label>File (SVG or transparent PNG preferred)</Label>
            <input type="file" name="file" accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif" required
              className="block w-full text-sm text-ink-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-ink-100 hover:file:bg-white/15" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <select value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}
              className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10">
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={pending}>{pending ? "Uploading…" : "Upload"}</Button>
        </form>
        <div className="mt-2">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="text-sm" />
        </div>
        {error && <div className="text-xs text-rose-300 mt-2">{error}</div>}
      </Card>

      {assets.length === 0 ? (
        <Card className="p-8 text-center text-ink-400 text-sm">
          No assets yet. Upload your logo first, then mark it as the <span className="text-ink-200">primary</span> so every ad carries it.
        </Card>
      ) : (
        byKind.map((g) => (
          <div key={g.key} className="space-y-3">
            <Eyebrow>{g.label}{g.items.length > 1 ? "s" : ""}</Eyebrow>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {g.items.map((a) => (
                <Card key={a.id} className="p-0 overflow-hidden">
                  <div className="aspect-[4/3] flex items-center justify-center p-6" style={CHECKER}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.file_path} alt={a.label || a.kind} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-ink-200 truncate">{a.label || a.kind}</span>
                      <div className="flex gap-1 shrink-0">
                        {a.role === "primary" && <Badge tone="ok">primary</Badge>}
                        {a.role === "inverse" && <Badge tone="info">inverse</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      {a.role !== "primary" && <button disabled={pending} onClick={() => act(() => setAssetRoleAction(a.id, "primary", slug))} className="text-ink-300 hover:text-white">Set primary</button>}
                      {a.role !== "inverse" && <button disabled={pending} onClick={() => act(() => setAssetRoleAction(a.id, "inverse", slug))} className="text-ink-300 hover:text-white">Set inverse</button>}
                      {a.role !== "" && <button disabled={pending} onClick={() => act(() => setAssetRoleAction(a.id, "", slug))} className="text-ink-400 hover:text-ink-100">Unset</button>}
                      <button disabled={pending} onClick={() => act(() => deleteAssetAction(a.id, slug))} className="ml-auto text-rose-300/80 hover:text-rose-300">Delete</button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
