import { Badge, Empty, Eyebrow, Section } from "@/components/ui/primitives";
import { getCampaign, listCampaignsByBrand, listGenerationsByCampaign } from "@/lib/repo";
import { AdPreview } from "@/components/ad-preview";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const { user, activeBrand } = await getSession();
  if (!user) redirect("/signin");
  if (!activeBrand) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto">
        <Empty title="No brand selected">Pick a brand from the board to open its Studio.</Empty>
      </div>
    );
  }

  const campaigns = listCampaignsByBrand(activeBrand.id);
  const all = campaigns.flatMap((c) => listGenerationsByCampaign(c.id));
  const pending = all.filter((g) => g.status === "pending_review").sort((a, b) => a.confidence - b.confidence);
  const revisions = all.filter((g) => g.status === "needs_revision");
  const approved = all.filter((g) => g.status === "approved").slice(0, 12);
  const rejected = all.filter((g) => g.status === "rejected").slice(0, 12);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-12">
      <div>
        <Eyebrow>{activeBrand.name} · review</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Review</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Triaged lowest-confidence first — the score is the QC Critic's call on voice fit, format ergonomics, and concept strength.
        </p>
      </div>

      <Section title={`Pending — ${pending.length}`} subtitle="Lowest confidence first.">
        {pending.length === 0 ? <Empty title="Queue clear">Generate creatives from any project to populate this view.</Empty> : <Grid items={pending} />}
      </Section>

      <Section title={`Revisions — ${revisions.length}`} subtitle="Sent back with reviewer notes.">
        {revisions.length === 0 ? <Empty title="No revisions">Nothing in revision.</Empty> : <Grid items={revisions} />}
      </Section>

      {approved.length > 0 && (
        <Section title={`Approved — ${approved.length}`} subtitle="Ready to hand over.">
          <Grid items={approved} />
        </Section>
      )}

      {rejected.length > 0 && (
        <Section title={`Rejected — ${rejected.length}`}>
          <Grid items={rejected} />
        </Section>
      )}
    </div>
  );
}

function Grid({ items }: { items: ReturnType<typeof listGenerationsByCampaign> }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((g) => {
        const camp = getCampaign(g.campaign_id);
        return (
          <Link key={g.id} href={`/ads/${g.id}`} className="block space-y-2">
            <AdPreview generationId={g.id} width={g.width} height={g.height} />
            <div className="flex items-center justify-between text-xs">
              <span className="text-ink-200 line-clamp-1">{g.format_slug}</span>
              <Badge tone={g.confidence > 0.85 ? "ok" : g.confidence > 0.7 ? "warn" : "danger"}>
                {(g.confidence * 100).toFixed(0)}
              </Badge>
            </div>
            <div className="text-[11px] text-ink-400 line-clamp-1">{camp?.name}</div>
          </Link>
        );
      })}
    </div>
  );
}
