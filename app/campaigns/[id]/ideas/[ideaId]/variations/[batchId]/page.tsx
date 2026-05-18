import { Badge, Card, Empty, Eyebrow, Section } from "@/components/ui/primitives";
import { getBrand, getCampaign, getIdea } from "@/lib/repo";
import { getVariationBatch, listBatchGenerations } from "@/lib/variations";
import { formatBySlug } from "@/lib/formats";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdPreview } from "@/components/ad-preview";
import { BatchControls, GroupBy } from "./controls";

export const dynamic = "force-dynamic";

export default async function BatchPage({ params, searchParams }: { params: Promise<{ id: string; ideaId: string; batchId: string }>; searchParams?: Promise<Record<string, string>> }) {
  const { id, ideaId, batchId } = await params;
  const sp = (await searchParams) || {};
  const campaign = getCampaign(id);
  const idea = getIdea(ideaId);
  const batch = getVariationBatch(batchId);
  if (!campaign || !idea || !batch) notFound();
  const brand = getBrand(campaign.brand_id);
  if (!brand) notFound();

  const gens = listBatchGenerations(batchId);
  const groupBy = (sp.groupBy as "format" | "headline" | "cta" | "subhead" | "eyebrow" | "image") || "format";

  const groups = groupGenerations(gens, groupBy);
  const approvedCount = gens.filter((g) => g.status === "approved").length;
  const rejectedCount = gens.filter((g) => g.status === "rejected").length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-8">
      <div>
        <Link href={`/campaigns/${campaign.id}/ideas/${idea.id}/variations`} className="text-xs text-ink-400 hover:text-ink-100">← Variations</Link>
        <div className="mt-2 flex items-end justify-between gap-6">
          <div>
            <Eyebrow>{idea.theme} · variation batch</Eyebrow>
            <h1 className="serif text-display-lg mt-1 tracking-tight">{batch.name}</h1>
            <div className="text-ink-300 mt-1 text-sm">
              {gens.length} ads · {batch.strategy} · {batch.formats.length} format{batch.formats.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={approvedCount > 0 ? "ok" : "neutral"}>{approvedCount} approved</Badge>
            <Badge tone={rejectedCount > 0 ? "danger" : "neutral"}>{rejectedCount} rejected</Badge>
          </div>
        </div>
      </div>

      <BatchControls
        batchId={batchId}
        campaignId={campaign.id}
        ideaId={idea.id}
        ids={gens.map((g) => g.id)}
        currentGroupBy={groupBy}
      />

      {gens.length === 0 ? (
        <Empty title="No generations">This batch is empty.</Empty>
      ) : (
        groups.map((g) => (
          <Section key={g.key} title={`${labelFor(groupBy)}: ${g.value || "—"}`}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {g.items.map((gen) => (
                <Link key={gen.id} href={`/ads/${gen.id}`} className="space-y-1.5 block">
                  <AdPreview generationId={gen.id} width={gen.width} height={gen.height} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-300 line-clamp-1">{gen.format_slug}</span>
                    <Badge tone={gen.status === "approved" ? "ok" : gen.status === "rejected" ? "danger" : gen.status === "needs_revision" ? "warn" : "neutral"}>
                      {gen.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-ink-400 line-clamp-1">{gen.headline.replace(/\n/g, " · ")}</div>
                </Link>
              ))}
            </div>
          </Section>
        ))
      )}
    </div>
  );
}

function labelFor(g: GroupBy): string {
  return { format: "Format", headline: "Headline", cta: "CTA", subhead: "Subhead", eyebrow: "Eyebrow", image: "Image" }[g];
}

function groupGenerations(gens: any[], by: GroupBy): Array<{ key: string; value: string; items: any[] }> {
  const map = new Map<string, { value: string; items: any[] }>();
  for (const g of gens) {
    let v = "—";
    if (by === "format") v = g.format_slug;
    else if (by === "headline") v = g.headline.replace(/\n/g, " · ");
    else if (by === "cta") v = g.cta;
    else if (by === "subhead") v = g.subhead || "—";
    else if (by === "eyebrow") v = g.eyebrow || "—";
    else if (by === "image") v = g.reference_id || "no image";
    const key = v.toLowerCase();
    const entry = map.get(key);
    if (entry) entry.items.push(g);
    else map.set(key, { value: v, items: [g] });
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, value: v.value, items: v.items }));
}
