import { Badge, Card, Empty, Eyebrow, LinkButton, Section, Stat } from "@/components/ui/primitives";
import { AdPreview } from "@/components/ad-preview";
import { listAllGenerations, listAllCampaigns, listCampaignsByBrand, listGenerationsByCampaign } from "@/lib/repo";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { user, brands, activeBrand } = await getSession();
  if (!user) redirect("/signin");

  if (!activeBrand) {
    return (
      <div className="px-8 py-16 max-w-3xl mx-auto space-y-8 text-center">
        <Eyebrow>Welcome</Eyebrow>
        <h1 className="serif text-display-xl tracking-tight">A studio without a brand is just an empty room.</h1>
        <p className="text-ink-300 text-base md:text-lg">
          Onboard a brand to get started. Augen will synthesize a token system and draft three campaigns for the next quarter.
        </p>
        <div className="flex justify-center gap-3">
          <LinkButton href="/brands/new" size="lg">Onboard a brand →</LinkButton>
        </div>
      </div>
    );
  }

  const campaigns = listCampaignsByBrand(activeBrand.id);
  const gens = campaigns.flatMap((c) => listGenerationsByCampaign(c.id));
  const pending = gens.filter((g) => g.status === "pending_review");
  const approved = gens.filter((g) => g.status === "approved");

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-12">
      <div className="flex items-start justify-between gap-8">
        <div className="max-w-2xl">
          <Eyebrow>{activeBrand.name} · studio</Eyebrow>
          <h1 className="serif text-display-xl tracking-tight mt-2">{activeBrand.tagline || "Design first. Run later."}</h1>
          <p className="text-ink-300 mt-3 text-base md:text-lg leading-relaxed">
            Plan a quarter, brainstorm ideas, generate ads, approve in one place. When marketing is ready, export the bundle.
          </p>
          <div className="flex gap-3 mt-6">
            <LinkButton href={`/brands/${activeBrand.slug}/plan`} size="lg">Plan a quarter →</LinkButton>
            <LinkButton href={`/brands/${activeBrand.slug}`} variant="ghost" size="lg">Brand overview</LinkButton>
          </div>
        </div>

        <Card className="hidden md:block w-[340px] p-6 bg-dot-grid">
          <Eyebrow>Brand snapshot</Eyebrow>
          <div className="grid grid-cols-2 gap-6 mt-4">
            <Stat label="Campaigns" value={campaigns.length} />
            <Stat label="Ads" value={gens.length} />
            <Stat label="Pending review" value={pending.length} />
            <Stat label="Approved" value={approved.length} />
          </div>
        </Card>
      </div>

      <Section
        title="Pending review"
        subtitle="Triaged low-to-high confidence."
        action={<LinkButton href="/review" variant="ghost" size="sm">Open review →</LinkButton>}
      >
        {pending.length === 0 ? (
          <Empty title="Queue clear">Generate ads from any campaign and they'll queue up here.</Empty>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pending.slice(0, 8).map((g) => (
              <Link key={g.id} href={`/ads/${g.id}`} className="group block space-y-2">
                <AdPreview generationId={g.id} width={g.width} height={g.height} />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-300">{g.format_slug}</span>
                  <Badge tone={g.confidence > 0.85 ? "ok" : g.confidence > 0.7 ? "warn" : "danger"}>
                    {(g.confidence * 100).toFixed(0)}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent campaigns" action={<LinkButton href="/campaigns" variant="ghost" size="sm">All campaigns →</LinkButton>}>
        {campaigns.length === 0 ? (
          <Empty title="No campaigns yet">
            <LinkButton href={`/brands/${activeBrand.slug}/plan`} className="mt-4">Plan a quarter →</LinkButton>
          </Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {campaigns.slice(0, 4).map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`}>
                <Card className="p-5 transition-colors hover:bg-ink-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="serif text-xl tracking-tight">{c.name}</div>
                      <div className="text-xs text-ink-400 mt-1">{relativeDate(c.created_at)} · {c.quarter} {c.year}</div>
                    </div>
                    <Badge tone={c.status === "approved" ? "ok" : c.status === "ready_for_review" ? "info" : "neutral"}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                    <div><Eyebrow>Audience</Eyebrow><div className="text-ink-200 mt-1 line-clamp-1">{c.audience || "—"}</div></div>
                    <div><Eyebrow>Objective</Eyebrow><div className="text-ink-200 mt-1">{c.objective || "—"}</div></div>
                    <div><Eyebrow>Formats</Eyebrow><div className="text-ink-200 mt-1">{c.brief.formats.length}</div></div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Approved & ready to hand over" subtitle="Approve ads from review to populate this shelf. Use Campaigns → Deliverables to download a bundle.">
        {approved.length === 0 ? (
          <Empty title="No approved ads yet">Approve ads from the review queue to populate this shelf.</Empty>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {approved.slice(0, 8).map((g) => (
              <Link key={g.id} href={`/ads/${g.id}`} className="block space-y-2">
                <AdPreview generationId={g.id} width={g.width} height={g.height} />
                <div className="text-xs text-ink-300">{g.format_slug}</div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
