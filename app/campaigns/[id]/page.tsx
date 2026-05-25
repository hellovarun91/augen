import { Badge, Card, Empty, Eyebrow, LinkButton, Section } from "@/components/ui/primitives";
import { getBrand, getCampaign, listCampaignFormats, listGenerationsByCampaign, listIdeas, listComments } from "@/lib/repo";
import { listMembershipsForBrand } from "@/lib/users";
import { getSession } from "@/lib/session";
import { ALL_FORMATS, formatBySlug, formatsByPlatform } from "@/lib/formats";
import { notFound } from "next/navigation";
import { AdPreview } from "@/components/ad-preview";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { CommentThread } from "@/components/comment-thread";
import { RunCampaignButton, BriefEditor, ProjectDetailActions, ProjectSignoff } from "./controls";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) notFound();
  const brand = getBrand(campaign.brand_id);
  if (!brand) notFound();
  const ideas = listIdeas(campaign.id);
  const gens = listGenerationsByCampaign(campaign.id);
  const byIdea = new Map<string, typeof gens>();
  for (const g of gens) {
    const arr = byIdea.get(g.idea_id || "") || [];
    arr.push(g);
    byIdea.set(g.idea_id || "", arr);
  }

  const groupedFormats = formatsByPlatform();
  const enabledFormats = new Set(campaign.brief.formats);
  const labels = Object.fromEntries(
    listCampaignFormats(campaign.id).filter((r) => r.label).map((r) => [r.format_slug, r.label!]),
  );

  const { user } = await getSession();
  const members = listMembershipsForBrand(brand.id).map((m) => ({ id: m.user_id, name: m.user.name, color: m.user.avatar_color }));
  const comments = listComments("project", campaign.id);
  const approvedCount = gens.filter((g) => g.status === "approved").length;
  const signedOffByName = campaign.signed_off_by ? (members.find((m) => m.id === campaign.signed_off_by)?.name || "A teammate") : null;

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-12">
      <SyncActiveBrand brandId={brand.id} />
      <header className="space-y-3">
        <Link href={`/brands/${brand.slug}`} className="text-xs text-ink-400 hover:text-ink-100">← {brand.name}</Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
          <div>
            <h1 className="serif text-display-lg tracking-tight">{campaign.name}</h1>
            <div className="text-ink-300 mt-1">{[campaign.quarter && `${campaign.quarter} ${campaign.year}`, campaign.objective, campaign.audience].filter(Boolean).join(" · ") || "Draft project"}</div>
            <div className="mt-2"><ProjectDetailActions campaignId={campaign.id} name={campaign.name} /></div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={campaign.status === "approved" ? "ok" : campaign.status === "ready_for_review" ? "info" : "neutral"}>
              {campaign.status}
            </Badge>
            <LinkButton href={`/campaigns/${campaign.id}/agents`} variant="ghost" size="sm">Agent chain →</LinkButton>
            <RunCampaignButton campaignId={campaign.id} ideaCount={ideas.length} />
          </div>
        </div>
      </header>

      {campaign.status === "generating" && (
        <div className="rounded-xl ring-1 ring-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100 flex items-center gap-2.5">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-300 border-t-transparent animate-spin shrink-0" />
          Generating ads — the agent chain is running. Refresh in a minute; the creatives appear here when it finishes.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-5"><Eyebrow>Audience</Eyebrow><div className="text-base mt-1 truncate">{campaign.audience || "—"}</div></Card>
        <Card className="p-5"><Eyebrow>Formats enabled</Eyebrow><div className="text-2xl font-medium mt-1">{campaign.brief.formats.length}</div></Card>
        <Card className="p-5"><Eyebrow>Creatives</Eyebrow><div className="text-2xl font-medium mt-1">{gens.length}</div></Card>
        <Card className="p-5"><Eyebrow>Approved</Eyebrow><div className="text-2xl font-medium mt-1">{approvedCount}</div></Card>
      </div>

      <ProjectSignoff
        campaignId={campaign.id}
        total={gens.length}
        approved={approvedCount}
        signedOffBy={signedOffByName}
        signedOffAt={campaign.signed_off_at}
      />

      <Section title="The brief" subtitle="Editable. The orchestrator reads this when you press Generate ads.">
        <BriefEditor campaign={campaign} groupedFormats={groupedFormats} labels={labels} />
      </Section>

      <Section
        title="Idea seeds"
        subtitle="The orchestrator fans these out across selected formats and variant counts."
      >
        {ideas.length === 0 ? (
          <Empty title="No ideas yet">Generate or edit ideas to give the engine something to work with.</Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {ideas.map((idea) => {
              const ideaGens = byIdea.get(idea.id) || [];
              return (
                <Card key={idea.id} className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="serif text-xl tracking-tight">{idea.theme}</div>
                      <div className="text-xs text-ink-400 mt-1">{idea.angle} · {idea.audience}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{ideaGens.length} ads</Badge>
                      <Link href={`/campaigns/${campaign.id}/ideas/${idea.id}/lab`} className="text-xs text-ink-200 hover:text-white">Copy Lab →</Link>
                      <Link href={`/campaigns/${campaign.id}/ideas/${idea.id}/variations`} className="text-xs text-ink-200 hover:text-white">Variations →</Link>
                    </div>
                  </div>
                  <div className="text-sm text-ink-200">{idea.insight}</div>
                  <div>
                    <Eyebrow>Hooks</Eyebrow>
                    <ul className="text-sm text-ink-200 mt-2 space-y-1">
                      {idea.hooks.slice(0, 4).map((h, i) => <li key={i}>· {h}</li>)}
                    </ul>
                  </div>
                  {ideaGens.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5">
                      {ideaGens.slice(0, 4).map((g) => (
                        <Link key={g.id} href={`/ads/${g.id}`} className="block">
                          <AdPreview generationId={g.id} width={g.width} height={g.height} className="!rounded-md" />
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      {gens.length > 0 && (
        <Section
          title="Deliverables"
          subtitle="Every creative this project produced, grouped by format. Click into any one to review."
          action={<LinkButton href={`/campaigns/${campaign.id}/deliverables`} variant="ghost" size="sm">Full deliverables view →</LinkButton>}
        >
          {Array.from(new Set(gens.map((g) => g.format_slug))).map((fs) => {
            const f = formatBySlug(fs)!;
            const slice = gens.filter((g) => g.format_slug === fs);
            return (
              <div key={fs} className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <Eyebrow>{f.platform} · {f.placement}</Eyebrow>
                    <div className="serif text-xl tracking-tight">{f.name} · {f.width}×{f.height}</div>
                  </div>
                  <Badge>{slice.length}</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {slice.map((g) => (
                    <Link key={g.id} href={`/ads/${g.id}`} className="block space-y-2">
                      <AdPreview generationId={g.id} width={g.width} height={g.height} />
                      <div className="flex items-center justify-between text-xs text-ink-300">
                        <span className="line-clamp-1">{g.headline.replace(/\n/g, " ")}</span>
                        <Badge tone={g.status === "approved" ? "ok" : g.status === "rejected" ? "danger" : g.status === "needs_revision" ? "warn" : "neutral"}>
                          {g.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </Section>
      )}

      <Section title="Discussion" subtitle="Talk it through with the team — @mention anyone on the brand.">
        <Card className="p-5">
          <CommentThread brandId={brand.id} targetType="project" targetId={campaign.id} members={members} currentUserId={user?.id || null} initial={comments} />
        </Card>
      </Section>
    </div>
  );
}
