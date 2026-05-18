import { Badge, Card, Empty, Eyebrow, Section } from "@/components/ui/primitives";
import { getCampaign, listGenerationsByCampaign } from "@/lib/repo";
import { formatBySlug } from "@/lib/formats";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdPreview } from "@/components/ad-preview";

export const dynamic = "force-dynamic";

export default async function DeliverablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCampaign(id);
  if (!c) notFound();
  const gens = listGenerationsByCampaign(c.id);

  const byFormat = new Map<string, typeof gens>();
  for (const g of gens) {
    const arr = byFormat.get(g.format_slug) || [];
    arr.push(g);
    byFormat.set(g.format_slug, arr);
  }

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto space-y-12">
      <div>
        <Link href={`/campaigns/${c.id}`} className="text-xs text-ink-400 hover:text-ink-100">← {c.name}</Link>
        <h1 className="serif text-display-lg mt-2 tracking-tight">Deliverables</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">All ad variants this campaign produced. Grouped by format and platform. Approved ads ship.</p>
      </div>

      {gens.length === 0 ? (
        <Empty title="Nothing generated yet">Run the campaign first.</Empty>
      ) : (
        Array.from(byFormat.entries()).map(([fs, slice]) => {
          const f = formatBySlug(fs)!;
          return (
            <Section key={fs} title={`${f.name}`}>
              <div className="text-xs text-ink-400 -mt-3 mb-3">{f.platform} · {f.placement} · {f.width}×{f.height} · {slice.length} variants</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {slice.map((g) => (
                  <Link key={g.id} href={`/ads/${g.id}`} className="space-y-2 block">
                    <AdPreview generationId={g.id} width={g.width} height={g.height} />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-200 line-clamp-1">{g.headline.replace(/\n/g, " ")}</span>
                      <Badge tone={g.status === "approved" ? "ok" : g.status === "rejected" ? "danger" : g.status === "needs_revision" ? "warn" : "neutral"}>
                        {g.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          );
        })
      )}
    </div>
  );
}
