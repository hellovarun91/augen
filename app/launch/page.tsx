import { Badge, Card, Empty, Eyebrow, LinkButton, Section, Stat } from "@/components/ui/primitives";
import { getBilling, listCampaignsByBrand, listGenerationsByCampaign, listTransactions } from "@/lib/repo";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { formatCents, relativeDate } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LaunchPage() {
  const { user, activeBrand } = await getSession();
  if (!user) redirect("/signin");
  if (!activeBrand) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto">
        <Empty title="No active brand">Switch to a brand to view launch readiness.</Empty>
      </div>
    );
  }

  const campaigns = listCampaignsByBrand(activeBrand.id);
  const allGens = campaigns.flatMap((c) => listGenerationsByCampaign(c.id));
  const approved = allGens.filter((g) => g.status === "approved");
  const billing = getBilling(activeBrand.id);
  const txns = billing ? listTransactions(activeBrand.id, 12) : [];

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-12">
      <div>
        <Eyebrow>{activeBrand.name} · Launch</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Run the approved work.</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Design happens upstream. This is where approved ads get shipped — packaged for marketing, or wired into Meta / Google when those integrations land.
          Money lives here, not in the design path.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-5"><Stat label="Approved & ready" value={approved.length} sub="ads waiting to ship" /></Card>
        <Card className="p-5"><Stat label="Campaigns" value={campaigns.length} /></Card>
        <Card className="p-5"><Stat label="Mock balance" value={formatCents(billing?.balance_cents || 0)} sub="studio credits" /></Card>
        <Card className="p-5"><Stat label="Monthly budget" value={formatCents(billing?.monthly_budget_cents || 0)} sub="brand cap" /></Card>
      </div>

      <Section
        title="Ready to launch"
        subtitle="Each campaign with approved ads is ready to be handed off."
      >
        {campaigns.length === 0 ? (
          <Empty title="No campaigns yet">Plan a quarter, then generate and approve ads to see them here.</Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {campaigns.map((c) => {
              const gens = listGenerationsByCampaign(c.id);
              const ok = gens.filter((g) => g.status === "approved").length;
              const total = gens.length;
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/campaigns/${c.id}`} className="serif text-xl tracking-tight hover:underline">
                        {c.name}
                      </Link>
                      <div className="text-xs text-ink-400 mt-1">{c.quarter} {c.year} · {relativeDate(c.created_at)}</div>
                    </div>
                    <Badge tone={ok > 0 ? "ok" : "neutral"}>{ok} of {total} approved</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                    <div><Eyebrow>Objective</Eyebrow><div className="text-ink-200 mt-1">{c.objective || "—"}</div></div>
                    <div><Eyebrow>Audience</Eyebrow><div className="text-ink-200 mt-1 line-clamp-1">{c.audience || "—"}</div></div>
                    <div><Eyebrow>Formats</Eyebrow><div className="text-ink-200 mt-1">{c.brief.formats.length}</div></div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <LinkButton href={`/campaigns/${c.id}/deliverables`} size="sm" variant="ghost">View deliverables →</LinkButton>
                    <LinkButton href={`/campaigns/${c.id}`} size="sm" variant="ghost">Open campaign</LinkButton>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Integrations" subtitle="Where this connects when you're ready. None of these are wired yet.">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { name: "Meta Ads Manager", note: "Upload Feed / Story / Reels approved assets with copy + audience presets.", status: "soon" },
            { name: "Google Ads", note: "Push Display + Discovery + Performance Max assets to the appropriate placements.", status: "soon" },
            { name: "Handover bundle", note: "Download all approved as a single ZIP with PNG/SVG + JSON manifest + brief.", status: "next" },
          ].map((c) => (
            <Card key={c.name} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="serif text-lg">{c.name}</div>
                <Badge tone={c.status === "next" ? "info" : "neutral"}>{c.status}</Badge>
              </div>
              <p className="text-sm text-ink-300 mt-2">{c.note}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Transactions" subtitle="Mock billing — recent activity for this brand.">
        {txns.length === 0 ? (
          <Empty title="No charges yet">Nothing has been spent against this brand's mock balance.</Empty>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-400">
                  <th className="px-4 py-3">When</th>
                  <th>Kind</th>
                  <th>Description</th>
                  <th className="text-right pr-4">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-ink-300">{relativeDate(t.created_at)}</td>
                    <td className="text-ink-200">{t.kind}</td>
                    <td className="text-ink-200">{t.description}</td>
                    <td className="text-right text-ink-100 pr-4">{t.kind === "charge" ? "−" : "+"}{formatCents(t.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>
    </div>
  );
}
