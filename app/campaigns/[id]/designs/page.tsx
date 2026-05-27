import { getCampaign, getBrand, listGenerationsByCampaign, listCopyRows, journeyProgress } from "@/lib/repo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { JourneyNav } from "@/components/journey-nav";
import { DesignGallery } from "./gallery";
import type { Generation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DesignsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) notFound();
  const brand = getBrand(campaign.brand_id);
  if (!brand) notFound();

  const rows = listCopyRows(campaign.id);
  const gens = listGenerationsByCampaign(campaign.id);
  const byRow: Record<string, Generation[]> = {};
  const standalone: Generation[] = [];
  for (const g of gens) {
    if (g.copy_row_id) (byRow[g.copy_row_id] ||= []).push(g);
    else standalone.push(g);
  }
  const toItem = (g: Generation) => ({ id: g.id, aspect: g.aspect, headline: g.headline, status: g.status, stale: g.stale });

  const groups: { rowId: string | null; name: string; rowApproved: boolean; designs: ReturnType<typeof toItem>[] }[] = [];
  for (const r of rows) {
    const ds = byRow[r.id];
    if (ds?.length) groups.push({ rowId: r.id, name: r.name || "Untitled variation", rowApproved: r.status === "approved", designs: ds.map(toItem) });
  }
  if (standalone.length) groups.push({ rowId: null, name: `${standalone.length} creative${standalone.length === 1 ? "" : "s"} not from the Copy Sheet`, rowApproved: false, designs: standalone.map(toItem) });

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-6">
      <SyncActiveBrand brandId={brand.id} />
      <div>
        <Link href={`/campaigns/${campaign.id}`} className="text-xs text-ink-400 hover:text-ink-100">← {campaign.name}</Link>
        <h1 className="serif text-display-lg mt-2 tracking-tight">Design &amp; review</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Every design your variations produced, grouped by variation. Approve the ones that work — a design ships only when
          <span className="text-ink-100"> its copy is approved</span> and <span className="text-ink-100">the design is approved</span>. Edit copy and it goes stale until re-rendered.
        </p>
      </div>

      <JourneyNav campaignId={campaign.id} current="design" progress={journeyProgress(campaign.id)} />

      <DesignGallery campaignId={campaign.id} groups={groups} />
    </div>
  );
}
