"use client";
import { Card, Eyebrow } from "@/components/ui/primitives";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewControls } from "./controls";
import { EditPanel } from "./edit-panel";
import { AdOverrides } from "@/lib/composer/overrides";
import type { BrandTokens } from "@/lib/types";

export function AdDetailClient({
  generation,
  overrides,
  tokens,
  ideaSummary,
}: {
  generation: {
    id: string; width: number; height: number;
    headline: string; subhead: string; cta: string; eyebrow: string;
    status: string; imagePrompt: string; copyVariants: number; isWinner: boolean;
  };
  overrides: AdOverrides;
  tokens: BrandTokens;
  ideaSummary: { theme: string; angle: string; audience: string; insight: string } | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"review" | "edit">("review");
  const [bump, setBump] = useState(0);

  const onReload = () => {
    setBump((b) => b + 1);
    router.refresh();
  };

  // The render endpoint is now no-cache, so bumping the `v` query is enough to force the browser to refetch.
  const cacheBuster = `t=${bump}`;
  const src = `/api/render/${generation.id}.svg?${cacheBuster}`;

  return (
    <div className="grid lg:grid-cols-[1fr,440px] gap-8">
      <div className="space-y-4">
        <div className="relative rounded-xl overflow-hidden bg-ink-900 ring-1 ring-white/5" style={{ aspectRatio: `${generation.width} / ${generation.height}` }}>
          <img src={src} alt="Ad preview" className="block w-full h-full object-contain" />
        </div>

        <Card className="p-4">
          <Eyebrow>Copy variants</Eyebrow>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {Array.from({ length: Math.max(generation.copyVariants, 1) }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="rounded-md overflow-hidden bg-ink-900 ring-1 ring-white/5" style={{ aspectRatio: `${generation.width} / ${generation.height}` }}>
                  <img src={`/api/render/${generation.id}.svg?v=v${i}&${cacheBuster}`} className="block w-full h-full object-contain" />
                </div>
                <div className="text-[11px] text-ink-400 text-center">Variant {i + 1}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <Eyebrow>Copy (current)</Eyebrow>
          <div className="serif text-2xl mt-2 whitespace-pre-line tracking-tight">{generation.headline}</div>
          {generation.subhead && <p className="text-ink-200 mt-2 text-sm">{generation.subhead}</p>}
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-ink-400">CTA</div>
            <div className="text-sm text-ink-100">{generation.cta} →</div>
          </div>
        </Card>

        {generation.imagePrompt && (
          <Card className="p-5 space-y-3">
            <Eyebrow>Image prompt (from Art Director)</Eyebrow>
            <pre className="text-[11px] text-ink-300 whitespace-pre-wrap font-mono leading-relaxed">{generation.imagePrompt}</pre>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex gap-1 rounded-full bg-ink-900 ring-1 ring-white/10 p-1">
          {(["review", "edit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={"flex-1 text-xs rounded-full px-3 py-1.5 transition-colors " + (tab === t ? "bg-ink-50 text-ink-950" : "text-ink-300 hover:bg-white/5")}
            >
              {t === "review" ? "Review" : "Custom edits"}
            </button>
          ))}
        </div>

        {tab === "review" ? (
          <>
            <ReviewControls
              generationId={generation.id}
              status={generation.status}
              initial={{ headline: generation.headline, subhead: generation.subhead, cta: generation.cta, eyebrow: generation.eyebrow }}
              isWinner={generation.isWinner}
            />
            {ideaSummary && (
              <Card className="p-5">
                <Eyebrow>From idea</Eyebrow>
                <div className="serif text-lg mt-1">{ideaSummary.theme}</div>
                <div className="text-xs text-ink-400 mt-1">{ideaSummary.angle} · {ideaSummary.audience}</div>
                {ideaSummary.insight && <p className="text-sm text-ink-200 mt-2">{ideaSummary.insight}</p>}
              </Card>
            )}
          </>
        ) : (
          <EditPanel
            generationId={generation.id}
            headline={generation.headline}
            overrides={overrides}
            tokens={tokens}
            reloadKey={bump}
            onReload={onReload}
          />
        )}
      </div>
    </div>
  );
}
