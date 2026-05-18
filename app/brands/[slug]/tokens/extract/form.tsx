"use client";
import { Button, Eyebrow, Input, Label } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { extractTokensAction, applyExtractedTokensAction } from "./actions";

export function ExtractForm({ brandId, brandSlug, brandName, industry, disabled }: {
  brandId: string; brandSlug: string; brandName: string; industry: string; disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rationale: string; tokens: any } | null>(null);
  const [imgPreview, setImgPreview] = useState<string | null>(null);

  function extract(fd: FormData) {
    setError(null);
    setResult(null);
    start(async () => {
      try {
        const r = await extractTokensAction(brandId, fd);
        setResult(r);
      } catch (e: any) { setError(e?.message || "Extraction failed"); }
    });
  }

  function apply() {
    if (!result) return;
    setError(null);
    start(async () => {
      try {
        await applyExtractedTokensAction(brandId, brandSlug, result.tokens);
      } catch (e: any) { setError(e?.message || "Apply failed"); }
    });
  }

  return (
    <div className="space-y-6">
      <form action={extract} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Reference design</Label>
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp"
            required
            disabled={disabled}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0];
              setImgPreview(f ? URL.createObjectURL(f) : null);
            }}
            className="block w-full text-xs text-ink-200 file:mr-3 file:rounded-full file:border-0 file:bg-ink-700 file:text-ink-50 file:text-xs file:px-3 file:py-1.5 hover:file:bg-ink-600"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Brand name hint</Label>
            <Input name="brandName" defaultValue={brandName} disabled={disabled} />
          </div>
          <div className="space-y-1.5">
            <Label>Industry hint</Label>
            <Input name="industry" defaultValue={industry} disabled={disabled} />
          </div>
        </div>
        <Button type="submit" disabled={pending || disabled}>{pending ? "Extracting…" : "Extract tokens →"}</Button>
        {error && <div className="text-sm text-rose-300">{error}</div>}
      </form>

      {imgPreview && (
        <div className="grid md:grid-cols-[1fr,1fr] gap-6">
          <div>
            <Eyebrow>Source</Eyebrow>
            <img src={imgPreview} className="mt-2 rounded-xl ring-1 ring-white/10 max-h-[420px] w-full object-contain bg-ink-900" alt="Source" />
          </div>
          {result && (
            <div className="space-y-4">
              <div>
                <Eyebrow>Rationale</Eyebrow>
                <p className="text-sm text-ink-200 mt-2">{result.rationale}</p>
              </div>
              <div>
                <Eyebrow>Palette</Eyebrow>
                <div className="flex flex-wrap gap-2 mt-2">
                  {Object.entries(result.tokens.palette as Record<string, string>).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 rounded-full bg-ink-800 ring-1 ring-white/10 px-2 py-1 text-xs">
                      <span className="w-3 h-3 rounded-full" style={{ background: v }} />
                      <span className="text-ink-200">{k}</span>
                      <span className="text-ink-500 font-mono">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><Eyebrow>Voice</Eyebrow><div className="text-ink-200 mt-1">{result.tokens.voice.description}</div></div>
                <div><Eyebrow>Imagery</Eyebrow><div className="text-ink-200 mt-1">{result.tokens.imagery.style} — {result.tokens.imagery.treatment}</div></div>
              </div>
              <details>
                <summary className="text-xs text-ink-300 cursor-pointer">Full JSON</summary>
                <pre className="text-[11px] text-ink-300 bg-ink-900 ring-1 ring-white/5 rounded-lg p-3 mt-2 overflow-x-auto">{JSON.stringify(result.tokens, null, 2)}</pre>
              </details>
              <Button onClick={apply} disabled={pending}>{pending ? "Applying…" : "Apply to brand →"}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
