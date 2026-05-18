"use client";
import { Button, Eyebrow, Input, Label } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { pullAction, pushAction, saveUrlAction } from "./actions";
import type { BrandTokens } from "@/lib/types";

export function FigmaSyncForm({
  brandId, brandSlug, fileUrl, currentTokens, disabled,
}: {
  brandId: string; brandSlug: string; fileUrl: string; currentTokens: BrandTokens; disabled?: boolean;
}) {
  const [url, setUrl] = useState(fileUrl);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pullResult, setPullResult] = useState<any | null>(null);

  function go(name: string, fn: () => Promise<unknown>, ok?: (r: any) => string) {
    setError(null); setInfo(null);
    start(async () => {
      try {
        const r = await fn();
        setInfo(ok ? ok(r) : `${name} ok`);
      } catch (e: any) { setError(e?.message || `${name} failed`); }
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-[1fr,auto] gap-3">
        <div className="space-y-1.5">
          <Label>Figma file URL or key</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.figma.com/design/AbCd1234/your-file"
            disabled={disabled}
          />
        </div>
        <div className="flex items-end">
          <Button variant="secondary" disabled={pending || disabled} onClick={() => go("Save", () => saveUrlAction(brandId, brandSlug, url))}>Save</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Button
          variant="primary"
          disabled={pending || disabled || !url}
          onClick={() => go("Pull", async () => {
            const r = await pullAction(brandId, brandSlug, url);
            setPullResult(r);
            return r;
          }, (r: any) => `Pulled ${r.variables.length} variables from "${r.collectionName}".`)}
        >
          Pull tokens from Figma →
        </Button>
        <Button
          variant="ghost"
          disabled={pending || disabled || !url}
          onClick={() => go("Push", () => pushAction(brandId, url), (r: any) => `Pushed ${r.created} new + ${r.updated} updated to "${r.collection}".`)}
        >
          Push current tokens to Figma ↑
        </Button>
      </div>

      {info && <div className="text-sm text-emerald-300">{info}</div>}
      {error && <div className="text-sm text-rose-300">{error}</div>}

      {pullResult && (
        <div className="rounded-xl ring-1 ring-white/5 bg-ink-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Eyebrow>Pulled — collection "{pullResult.collectionName}"</Eyebrow>
            <span className="text-xs text-ink-400">{pullResult.variables.length} variables</span>
          </div>
          {pullResult.warnings?.length > 0 && (
            <ul className="text-xs text-amber-200 space-y-0.5">
              {pullResult.warnings.map((w: string, i: number) => <li key={i}>· {w}</li>)}
            </ul>
          )}
          {pullResult.tokens?.palette && (
            <div>
              <Eyebrow>Palette</Eyebrow>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(pullResult.tokens.palette as Record<string, string>).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 rounded-full bg-ink-800 ring-1 ring-white/10 px-2 py-1 text-xs">
                    <span className="w-3 h-3 rounded-full" style={{ background: v }} />
                    <span className="text-ink-200">{k}</span>
                    <span className="text-ink-500 font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <details>
            <summary className="text-xs text-ink-300 cursor-pointer">Variables seen</summary>
            <ul className="text-[11px] text-ink-300 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 max-h-72 overflow-auto">
              {pullResult.variables.map((v: any, i: number) => (
                <li key={i} className="flex gap-2"><span className="text-ink-500 font-mono">{v.type}</span><span>{v.name}</span></li>
              ))}
            </ul>
          </details>
          <Button
            disabled={pending}
            onClick={() => go("Apply", async () => {
              // Merge pulled tokens with current and persist
              const merged: BrandTokens = { ...currentTokens, ...pullResult.tokens, palette: { ...currentTokens.palette, ...(pullResult.tokens.palette || {}) }, fonts: { ...currentTokens.fonts, ...(pullResult.tokens.fonts || {}) } };
              const { applyPulledAction } = await import("./actions");
              return applyPulledAction(brandId, brandSlug, merged);
            }, () => "Tokens merged into brand. Engine picks them up on the next generation.")}
          >
            Apply pulled tokens
          </Button>
        </div>
      )}
    </div>
  );
}
