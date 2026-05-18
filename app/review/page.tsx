import { Badge, Card, Empty, Eyebrow, Section } from "@/components/ui/primitives";
import { getBrand, getCampaign, listGenerationsByStatus } from "@/lib/repo";
import { AdPreview } from "@/components/ad-preview";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const pending = listGenerationsByStatus("pending_review", 200);
  const revisions = listGenerationsByStatus("needs_revision", 100);
  pending.sort((a, b) => a.confidence - b.confidence);

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto space-y-12">
      <div>
        <Eyebrow>Studio queue</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Review</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Triaged low-confidence first. Approve to ship, reject to drop, revise to send back with notes.
        </p>
      </div>

      <Section title={`Pending — ${pending.length}`} subtitle="Lowest confidence first.">
        {pending.length === 0 ? (
          <Empty title="Queue empty">Run a campaign to populate this view.</Empty>
        ) : (
          <Grid items={pending} />
        )}
      </Section>

      <Section title={`Revisions — ${revisions.length}`} subtitle="Sent back with reviewer notes.">
        {revisions.length === 0 ? (
          <Empty title="No revisions">Nice — nothing in revision.</Empty>
        ) : (
          <Grid items={revisions} />
        )}
      </Section>
    </div>
  );
}

function Grid({ items }: { items: ReturnType<typeof listGenerationsByStatus> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((g) => {
        const brand = getBrand(g.brand_id);
        const camp = getCampaign(g.campaign_id);
        return (
          <Link key={g.id} href={`/ads/${g.id}`} className="block space-y-2">
            <AdPreview generationId={g.id} width={g.width} height={g.height} />
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-200 line-clamp-1">{brand?.name}</span>
              <Badge tone={g.confidence > 0.85 ? "ok" : g.confidence > 0.7 ? "warn" : "danger"}>
                {(g.confidence * 100).toFixed(0)}
              </Badge>
            </div>
            <div className="text-[11px] text-ink-400 line-clamp-1">{camp?.name} · {g.format_slug}</div>
          </Link>
        );
      })}
    </div>
  );
}
