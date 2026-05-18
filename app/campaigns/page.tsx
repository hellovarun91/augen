import { Badge, Card, Empty, Eyebrow, LinkButton, Section } from "@/components/ui/primitives";
import { listCampaignsByBrand, getBrand } from "@/lib/repo";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const { activeBrand } = await getSession();
  if (!activeBrand) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto">
        <Empty title="No active brand">Onboard a brand or switch to one in the sidebar.</Empty>
      </div>
    );
  }
  const campaigns = listCampaignsByBrand(activeBrand.id);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-10">
      <Section
        title={`${activeBrand.name} · campaigns`}
        subtitle="Each campaign is a brief, a set of ideas, and the ads they produced. Money is not on this page — it lives under Launch."
        action={<LinkButton href={`/brands/${activeBrand.slug}/plan`}>Plan another quarter →</LinkButton>}
      >
        {campaigns.length === 0 ? (
          <Empty title="No campaigns yet">Plan a quarter to seed three drafts.</Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {campaigns.map((c) => {
              const brand = getBrand(c.brand_id);
              return (
                <Link key={c.id} href={`/campaigns/${c.id}`}>
                  <Card className="p-5 transition-colors hover:bg-ink-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: brand?.tokens.palette.primary }} />
                          <div className="text-xs text-ink-300">{brand?.name}</div>
                        </div>
                        <div className="serif text-xl tracking-tight mt-1">{c.name}</div>
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
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
