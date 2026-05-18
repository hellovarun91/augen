"use client";
import { Badge, Button, Card, Eyebrow, Input, Label, TextArea } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { spinVariantsAction, starVariantAction, deleteVariantAction } from "./actions";
import { AdPreviewPreview } from "@/components/ad-preview";

interface VariantRow {
  id: string;
  idea_id: string;
  headline: string;
  subhead: string | null;
  cta: string | null;
  eyebrow: string | null;
  note: string | null;
  starred: number;
  source: string;
  created_at: number;
}

export function LabControls({
  campaignId,
  ideaId,
  brandId,
  recentHeadlines,
}: {
  campaignId: string;
  ideaId: string;
  brandId: string;
  recentHeadlines: string[];
}) {
  const [constraint, setConstraint] = useState("");
  const [count, setCount] = useState(8);
  const [formatSlug, setFormatSlug] = useState("meta-feed-4x5");
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function spin() {
    setError(null); setInfo(null);
    start(async () => {
      try {
        const result = await spinVariantsAction(campaignId, ideaId, {
          formatSlug,
          count,
          constraint: constraint || undefined,
          carryForward: recentHeadlines,
        });
        setInfo(`${result.count} new variants drafted.`);
      } catch (e: any) { setError(e?.message || "Spin failed"); }
    });
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1 col-span-2">
          <Label>Constraint (optional)</Label>
          <Input value={constraint} onChange={(e) => setConstraint(e.target.value)} placeholder="shorter · lead with benefit · less precious · sharper · category counterpoint" />
        </div>
        <div className="space-y-1">
          <Label>Count</Label>
          <select value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))} className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10">
            {[4, 6, 8, 12, 16, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1 col-span-2">
          <Label>Preview format</Label>
          <select value={formatSlug} onChange={(e) => setFormatSlug(e.target.value)} className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10">
            <option value="meta-feed-1x1">Meta Feed 1:1</option>
            <option value="meta-feed-4x5">Meta Feed 4:5</option>
            <option value="meta-story-9x16">Meta Story 9:16</option>
            <option value="google-display-300x250">Google Display 300×250</option>
            <option value="google-display-300x600">Google Display 300×600</option>
            <option value="google-display-728x90">Google Leaderboard 728×90</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={spin} disabled={pending}>{pending ? "Spinning…" : "Spin variants →"}</Button>
        </div>
      </div>
      {info && <div className="text-xs text-emerald-300">{info}</div>}
      {error && <div className="text-xs text-rose-300">{error}</div>}
    </Card>
  );
}

export function VariantList({ variants, brandId, limits }: { variants: VariantRow[]; brandId: string; limits?: { headlineMaxChars: number; subheadMaxChars: number; ctaMaxChars: number; eyebrowMaxChars: number } }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [_, start] = useTransition();
  const lim = limits || { headlineMaxChars: 48, subheadMaxChars: 120, ctaMaxChars: 24, eyebrowMaxChars: 18 };
  function counterClass(n: number, max: number): string {
    return n > max ? "text-rose-300" : n > max * 0.9 ? "text-amber-200" : "text-ink-400";
  }
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {variants.map((v) => {
        const hLen = v.headline.replace(/\s+/g, " ").trim().length;
        const sLen = (v.subhead || "").length;
        const cLen = (v.cta || "").length;
        return (
        <Card key={v.id} className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="serif text-xl tracking-tight whitespace-pre-line flex-1">{v.headline}</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setPendingId(v.id); start(async () => { await starVariantAction(v.id, v.starred === 0); setPendingId(null); }); }}
                className={"text-xs rounded-full px-2 py-1 ring-1 " + (v.starred ? "bg-amber-500/15 text-amber-200 ring-amber-500/30" : "bg-white/5 text-ink-300 ring-white/10")}
              >
                {v.starred ? "★ winner" : "★ star"}
              </button>
              <button
                onClick={() => { setPendingId(v.id); start(async () => { await deleteVariantAction(v.id); setPendingId(null); }); }}
                className="text-[11px] text-ink-400 hover:text-rose-300"
              >
                del
              </button>
            </div>
          </div>
          {v.subhead && <div className="text-sm text-ink-300">{v.subhead}</div>}
          <div className="flex items-center justify-between text-xs">
            <Badge>{v.source}</Badge>
            <div className="flex items-center gap-3 text-[11px]">
              <span className={counterClass(hLen, lim.headlineMaxChars)}>H {hLen}/{lim.headlineMaxChars}</span>
              {v.subhead && <span className={counterClass(sLen, lim.subheadMaxChars)}>S {sLen}/{lim.subheadMaxChars}</span>}
              <span className={counterClass(cLen, lim.ctaMaxChars)}>{v.cta || "—"} ({cLen}/{lim.ctaMaxChars})</span>
            </div>
          </div>
          {v.note && <div className="text-[11px] text-ink-500 italic">{v.note}</div>}
          <details className="pt-1">
            <summary className="text-xs text-ink-300 cursor-pointer hover:text-ink-100">Preview in feed</summary>
            <div className="mt-2 max-w-xs">
              <AdPreviewPreview
                brandId={brandId}
                formatSlug="meta-feed-4x5"
                copy={{
                  eyebrow: v.eyebrow || "FIELD-TESTED",
                  headline: v.headline,
                  subhead: v.subhead || "",
                  cta: v.cta || "Learn more",
                }}
              />
            </div>
          </details>
        </Card>
        );
      })}
    </div>
  );
}
