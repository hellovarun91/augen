import { Badge, Card, Empty, Eyebrow, Section } from "@/components/ui/primitives";
import { getBrandBySlug, listAnchorCopy, listExternalWinners } from "@/lib/repo";
import { notFound } from "next/navigation";
import { AddWinnerForm, CsvImportForm, WinnerRowControls } from "./controls";
import { relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WinnersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const winners = listExternalWinners(brand.id);
  const anchors = listAnchorCopy(brand.id, 12);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-6xl mx-auto space-y-10">
      <div>
        <Eyebrow>{brand.name} · performance feedback</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Winners feed the agents.</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Paste past winning ads — from Google Ads, Meta, or anywhere they ran — and they become voice-confirmed examples in the
          Strategist and Copywriter system prompts. The chain quietly drifts toward what worked.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-6">
          <Eyebrow>Add a winner manually</Eyebrow>
          <AddWinnerForm brandId={brand.id} brandSlug={brand.slug} />
        </Card>
        <Card className="p-6">
          <Eyebrow>Import CSV</Eyebrow>
          <CsvImportForm brandId={brand.id} brandSlug={brand.slug} />
        </Card>
      </div>

      <Section title={`Winners — ${winners.length}`} subtitle="These show up in Claude's system block on every following call.">
        {winners.length === 0 ? (
          <Empty title="No winners yet">Add one above to start the learning loop.</Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {winners.map((w) => (
              <Card key={w.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {w.eyebrow && <div className="text-[10px] uppercase tracking-[0.18em] text-ink-300 mb-1">{w.eyebrow}</div>}
                    <div className="serif text-xl whitespace-pre-line">{w.headline}</div>
                    {w.subhead && <div className="text-sm text-ink-300 mt-2">{w.subhead}</div>}
                    {w.cta && <div className="text-xs text-ink-400 mt-2">CTA: {w.cta}</div>}
                  </div>
                  <WinnerRowControls id={w.id} />
                </div>
                <div className="flex items-center justify-between mt-4 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {w.source && <Badge tone="info">{w.source}</Badge>}
                    {w.format_slug && <Badge>{w.format_slug}</Badge>}
                    {w.metric_label && <Badge tone="ok">{w.metric_label}</Badge>}
                  </div>
                  <span className="text-ink-500">{relativeDate(w.created_at)}</span>
                </div>
                {w.notes && <div className="text-xs text-ink-400 mt-2 italic">{w.notes}</div>}
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="What Claude sees" subtitle="The anchors block that gets injected into every Strategist + Copywriter call.">
        {anchors.length === 0 ? (
          <Empty title="No anchors yet">Once you approve ads or add winners, this is what the agents read.</Empty>
        ) : (
          <Card className="p-5">
            <ul className="space-y-2">
              {anchors.map((a, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Badge tone={a.source === "winner" ? "ok" : a.source === "starred" ? "info" : "neutral"}>{a.source}</Badge>
                  <div className="flex-1">
                    <div className="serif text-base whitespace-pre-line">{a.headline}</div>
                    {a.subhead && <div className="text-xs text-ink-400 mt-0.5">{a.subhead}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>

      <Section title="CSV format" subtitle="Same columns the import accepts.">
        <Card className="p-5">
          <pre className="text-[11px] text-ink-300 leading-relaxed">{`headline,subhead,cta,eyebrow,format_slug,source,metric_label,notes
"Begin with Tanda.","Wild fermented. Low sugar.","Find a store","JUST IN","meta-feed-4x5","meta_ads","ROAS 4.1x","Top performer Q2"
"The honest pour.","Made by feel.","Order today","STARTING TODAY","meta-feed-1x1","google_ads","CTR 2.8%",""`}</pre>
        </Card>
      </Section>
    </div>
  );
}
