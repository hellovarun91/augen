"use client";
import { Badge, Button, Card, Eyebrow, Input } from "@/components/ui/primitives";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BrandAsset, AssetKind } from "@/lib/repo";
import { uploadAssetAction, deleteAssetAction, setAssetRoleAction } from "./actions";

const KINDS: Array<{ key: AssetKind; label: string }> = [
  { key: "logo", label: "Logo" },
  { key: "mark", label: "Logo mark" },
  { key: "icon", label: "Icon" },
  { key: "badge", label: "Badge" },
  { key: "graphic", label: "Graphic" },
];

const ACCEPT = "image/svg+xml,image/png,image/jpeg,image/webp,image/gif";
const ALLOWED = /^image\/(png|jpe?g|webp|svg\+xml|gif)$/;

// Transparency checkerboard so light and dark assets both read on the dark UI.
const CHECKER: React.CSSProperties = {
  backgroundColor: "#2c2c30",
  backgroundImage:
    "linear-gradient(45deg,#1f1f23 25%,transparent 25%),linear-gradient(-45deg,#1f1f23 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1f1f23 75%),linear-gradient(-45deg,transparent 75%,#1f1f23 75%)",
  backgroundSize: "14px 14px",
  backgroundPosition: "0 0,0 7px,7px -7px,-7px 0",
};

function guessKind(name: string): AssetKind {
  const n = name.toLowerCase();
  if (n.includes("icon")) return "icon";
  if (n.includes("badge") || n.includes("seal")) return "badge";
  if (n.includes("mark")) return "mark";
  if (n.includes("logo") || n.includes("wordmark")) return "logo";
  return "logo";
}
function baseName(name: string) { return name.replace(/\.[a-z0-9]+$/i, ""); }

interface Staged { id: string; file: File; previewUrl: string; label: string; kind: AssetKind; }

export function AssetManager({ brandId, slug, assets }: { brandId: string; slug: string; assets: BrandAsset[] }) {
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter((f) => ALLOWED.test(f.type));
    const rejected = Array.from(files).length - incoming.length;
    if (rejected > 0) setError(`${rejected} file(s) skipped — use SVG, PNG, JPG, WEBP, or GIF.`);
    else setError(null);
    setStaged((s) => [
      ...s,
      ...incoming.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file, previewUrl: URL.createObjectURL(file),
        label: baseName(file.name), kind: guessKind(file.name),
      })),
    ]);
  }
  function patchStaged(id: string, patch: Partial<Staged>) {
    setStaged((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function removeStaged(id: string) {
    setStaged((s) => { const t = s.find((x) => x.id === id); if (t) URL.revokeObjectURL(t.previewUrl); return s.filter((x) => x.id !== id); });
  }

  function uploadAll() {
    if (!staged.length) return;
    setError(null);
    start(async () => {
      try {
        for (const item of staged) {
          const fd = new FormData();
          fd.set("file", item.file);
          fd.set("kind", item.kind);
          fd.set("label", item.label.trim());
          await uploadAssetAction(brandId, fd);
        }
        staged.forEach((s) => URL.revokeObjectURL(s.previewUrl));
        setStaged([]);
        router.refresh();
      } catch (e: any) { setError(e?.message || "Upload failed"); }
    });
  }
  function act(fn: () => Promise<void>) { start(async () => { try { await fn(); router.refresh(); } catch (e: any) { setError(e?.message || "Failed"); } }); }

  const byKind = KINDS.map((k) => ({ ...k, items: assets.filter((a) => a.kind === k.key) })).filter((g) => g.items.length);

  return (
    <div className="space-y-8">
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={"rounded-2xl border border-dashed p-8 text-center cursor-pointer transition-colors " + (dragging ? "border-white/40 bg-white/[0.04]" : "border-white/15 hover:bg-white/[0.02]")}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden"
          onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
        <div className="text-sm text-ink-200">Drag & drop assets here, or <span className="text-white underline">browse</span></div>
        <div className="text-[11px] text-ink-400 mt-1">Multiple files OK · SVG or transparent PNG preferred · max 6MB each</div>
      </div>

      {error && <div className="text-xs text-rose-300">{error}</div>}

      {/* Staging — set a label + type per file before uploading */}
      {staged.length > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Eyebrow>Ready to upload · {staged.length}</Eyebrow>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { staged.forEach((s) => URL.revokeObjectURL(s.previewUrl)); setStaged([]); }} disabled={pending}>Clear</Button>
              <Button size="sm" onClick={uploadAll} disabled={pending}>{pending ? "Uploading…" : `Upload ${staged.length}`}</Button>
            </div>
          </div>
          <div className="space-y-2">
            {staged.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg ring-1 ring-white/10 p-2">
                <div className="w-12 h-12 rounded-md shrink-0 flex items-center justify-center overflow-hidden" style={CHECKER}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.previewUrl} alt="" className="max-h-full max-w-full object-contain" />
                </div>
                <Input value={s.label} onChange={(e) => patchStaged(s.id, { label: e.target.value })} placeholder="Label" className="text-sm flex-1" />
                <select value={s.kind} onChange={(e) => patchStaged(s.id, { kind: e.target.value as AssetKind })}
                  className="rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10 shrink-0">
                  {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
                <button onClick={() => removeStaged(s.id)} className="text-ink-400 hover:text-white text-sm shrink-0 px-1">✕</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Library */}
      {assets.length === 0 && staged.length === 0 ? (
        <Card className="p-8 text-center text-ink-400 text-sm">
          No assets yet. Drop your logo above, then mark it as the <span className="text-ink-200">primary</span> so every ad carries it.
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
