import { Badge, Empty, Eyebrow, Section } from "@/components/ui/primitives";
import { getCampaign, getBrand, listGenerationsByCampaign, listReadyDesigns, journeyProgress } from "@/lib/repo";
import { formatBySlug } from "@/lib/formats";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdPreview } from "@/components/ad-preview";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { JourneyNav } from "@/components/journey-nav";

export const dynamic = "force-dynamic";

export default async function DeliverablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCampaign(id);
  if (!c) notFound();
  const brand = getBrand(c.brand_id);
  if (!brand) notFound();

  const ready = listReadyDesigns(c.id);
  const totalDesigns = listGenerationsByCampaign(c.id).length;

  const byFormat = new Map<string, typeof ready>();
  for (const g of ready) {
    const arr = byFormat.get(g.format_slug) || [];
    arr.push(g);
    byFormat.set(g.format_slug, arr);
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-6">
      <SyncActiveBrand brandId={brand.id} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div>
          <Link href={`/campaigns/${c.id}`} className="text-xs text-ink-400 hover:text-ink-100">← {c.name}</Link>
          <h1 className="serif text-display-lg mt-2 tracking-tight">Deliverables</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            Only <span className="text-ink-100">ready</span> designs land here — copy approved, design approved, not stale.
            Download the bundle or pull them into Figma with the Augen plugin.
          </p>
        </div>
        {ready.length > 0 && (
          <div className="flex flex-col items-end gap-2">
            <a
              href={`/api/campaigns/${c.id}/export.zip`}
              className="inline-flex items-center gap-2 rounded-full bg-ink-50 text-ink-950 hover:bg-white h-10 px-4 text-sm font-medium tracking-tight"
            >
              Download bundle ↓
            </a>
            <a href={`/api/campaigns/${c.id}/export.zip?approved=0`} className="text-xs text-ink-400 hover:text-ink-100">
              or download every variant
            </a>
          </div>
        )}
      </div>

      <JourneyNav campaignId={c.id} current="deliverables" progress={journeyProgress(c.id)} />

      {ready.length === 0 ? (
        <Empty title="Nothing ready to ship yet">
          {totalDesigns === 0
            ? <>Generate designs from the <Link href={`/campaigns/${c.id}/copy`} className="text-ink-200 hover:text-white">Copy Sheet</Link> first.</>
            : <>You have {totalDesigns} design{totalDesigns === 1 ? "" : "s"} in <Link href={`/campaigns/${c.id}/designs`} className="text-ink-200 hover:text-white">Design &amp; review</Link>. Approve the copy on a row and approve the design — both — and they appear here.</>}
        </Empty>
      ) : (
        Array.from(byFormat.entries()).map(([fs, slice]) => {
          const f = formatBySlug(fs)!;
          return (
            <Section key={fs} title={`${f.name}`}>
              <div className="text-xs text-ink-400 -mt-3 mb-3">{f.platform} · {f.placement} · {f.width}×{f.height} · {slice.length} ready</div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {slice.map((g) => (
                  <Link key={g.id} href={`/ads/${g.id}`} className="space-y-2 block">
                    <AdPreview generationId={g.id} width={g.width} height={g.height} />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-ink-200 line-clamp-1">{g.headline.replace(/\n/g, " ")}</span>
                      <Badge tone="ok">ready</Badge>
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
