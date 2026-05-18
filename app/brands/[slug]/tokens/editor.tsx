"use client";
import { Button, Card, Eyebrow, Input, Label, TextArea } from "@/components/ui/primitives";
import type { Brand, BrandTokens } from "@/lib/types";
import { useState, useTransition } from "react";
import { saveTokens } from "./actions";
import { AdPreviewPreview } from "@/components/ad-preview";

export function TokensEditor({ brand }: { brand: Brand }) {
  const [tokens, setTokens] = useState<BrandTokens>(brand.tokens);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [bumpVersion, setBumpVersion] = useState(0);

  function patchPalette(k: keyof typeof tokens.palette, v: string) {
    setTokens({ ...tokens, palette: { ...tokens.palette, [k]: v } });
  }
  function patchVoice(k: keyof typeof tokens.voice, v: any) {
    setTokens({ ...tokens, voice: { ...tokens.voice, [k]: v } });
  }
  function patchImagery(k: keyof typeof tokens.imagery, v: any) {
    setTokens({ ...tokens, imagery: { ...tokens.imagery, [k]: v } });
  }
  function patchScrim(k: keyof typeof tokens.scrim, v: any) {
    setTokens({ ...tokens, scrim: { ...tokens.scrim, [k]: v } });
  }
  function patchLocker(k: keyof typeof tokens.locker, v: any) {
    setTokens({ ...tokens, locker: { ...tokens.locker, [k]: v } });
  }
  function patchFonts(k: keyof typeof tokens.fonts, v: any) {
    setTokens({ ...tokens, fonts: { ...tokens.fonts, [k]: v } });
  }

  async function onSave() {
    setError(null);
    start(async () => {
      try {
        await saveTokens(brand.id, tokens);
        setSaved(true);
        setBumpVersion((v) => v + 1);
        setTimeout(() => setSaved(false), 1800);
      } catch (e: any) {
        setError(e?.message || "Save failed");
      }
    });
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="p-6">
          <Eyebrow>Palette</Eyebrow>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {(Object.keys(tokens.palette) as Array<keyof typeof tokens.palette>).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label>{k}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={tokens.palette[k]}
                    onChange={(e) => patchPalette(k, e.target.value)}
                    className="h-9 w-12 rounded-md ring-1 ring-white/10 bg-ink-800 cursor-pointer"
                  />
                  <Input value={tokens.palette[k]} onChange={(e) => patchPalette(k, e.target.value)} className="font-mono text-xs" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <Eyebrow>Typography</Eyebrow>
          <div className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label>Display family (CSS stack)</Label>
              <Input value={tokens.fonts.display} onChange={(e) => patchFonts("display", e.target.value)} className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Body family (CSS stack)</Label>
              <Input value={tokens.fonts.body} onChange={(e) => patchFonts("body", e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <Eyebrow>Voice</Eyebrow>
          <div className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <TextArea value={tokens.voice.description} onChange={(e) => patchVoice("description", e.target.value)} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Tone (comma-separated)</Label>
              <Input
                value={tokens.voice.tone.join(", ")}
                onChange={(e) => patchVoice("tone", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Do not (one per line)</Label>
              <TextArea
                value={tokens.voice.doNot.join("\n")}
                onChange={(e) => patchVoice("doNot", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                rows={3}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <Eyebrow>Imagery</Eyebrow>
          <div className="space-y-3 mt-4">
            <div className="space-y-1.5">
              <Label>Style</Label>
              <select
                value={tokens.imagery.style}
                onChange={(e) => patchImagery("style", e.target.value)}
                className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10"
              >
                {["editorial", "minimalist", "vibrant", "moody", "premium", "playful", "industrial", "natural"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Treatment</Label>
              <TextArea value={tokens.imagery.treatment} onChange={(e) => patchImagery("treatment", e.target.value)} rows={3} />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <Eyebrow>Scrim & locker</Eyebrow>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="space-y-1.5">
              <Label>Bottom opacity ({tokens.scrim.bottomOpacity.toFixed(2)})</Label>
              <input
                type="range" min="0" max="1" step="0.05"
                value={tokens.scrim.bottomOpacity}
                onChange={(e) => patchScrim("bottomOpacity", parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Coverage ({tokens.scrim.coverage.toFixed(2)})</Label>
              <input
                type="range" min="0.2" max="1" step="0.05"
                value={tokens.scrim.coverage}
                onChange={(e) => patchScrim("coverage", parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Locker wordmark</Label>
              <Input value={tokens.locker.wordmark} onChange={(e) => patchLocker("wordmark", e.target.value)} />
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={onSave} disabled={pending}>{pending ? "Saving…" : "Save tokens"}</Button>
          {saved && <span className="text-xs text-emerald-300">Saved — preview rebuilt.</span>}
          {error && <span className="text-xs text-rose-300">{error}</span>}
        </div>
      </div>

      <div className="space-y-4">
        <Card className="p-4 sticky top-6">
          <Eyebrow>Live preview · 4:5 feed</Eyebrow>
          <div className="mt-3">
            <AdPreviewPreview
              key={bumpVersion + "-fb45"}
              brandId={brand.id}
              formatSlug="meta-feed-4x5"
              copy={{
                eyebrow: "FIELD-TESTED",
                headline: `${brand.name}.\nQuietly\ncorrect.`,
                subhead: "Designed to be the default, not the experiment.",
                cta: "Shop the season",
              }}
            />
          </div>
        </Card>
        <Card className="p-4">
          <Eyebrow>Live preview · 9:16 story</Eyebrow>
          <div className="mt-3 max-w-xs mx-auto">
            <AdPreviewPreview
              key={bumpVersion + "-st"}
              brandId={brand.id}
              formatSlug="meta-story-9x16"
              copy={{
                eyebrow: "LIMITED",
                headline: `Long light\nseason.`,
                subhead: "Crafted with intent. Sold by feel.",
                cta: "Find a store",
              }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
