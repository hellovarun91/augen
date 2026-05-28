import { getCampaign, getBrand, getProjectCopySchema, syncCopyRowsForCampaign, listDesignsByRow, journeyProgress, listReferences } from "@/lib/repo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { JourneyNav } from "@/components/journey-nav";
import { CopySheet } from "./sheet";

export const dynamic = "force-dynamic";

export default async function ProjectCopyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = getCampaign(id);
  if (!campaign) notFound();
  const brand = getBrand(campaign.brand_id);
  if (!brand) notFound();
  const schema = getProjectCopySchema(campaign.id);
  const rows = syncCopyRowsForCampaign(campaign.id);
  const designsByRow = listDesignsByRow(campaign.id);
  const initialDesigns: Record<string, { id: string; aspect: string; format_slug: string; status: string; stale: number }[]> = {};
  for (const [rowId, gens] of Object.entries(designsByRow)) {
    initialDesigns[rowId] = gens.map((g) => ({ id: g.id, aspect: g.aspect, format_slug: g.format_slug, status: g.status, stale: g.stale }));
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-[1400px] mx-auto space-y-6">
      <SyncActiveBrand brandId={brand.id} />
      <div>
        <Link href={`/campaigns/${campaign.id}`} className="text-xs text-ink-400 hover:text-ink-100">← {campaign.name}</Link>
        <h1 className="serif text-display-lg mt-2 tracking-tight">Copy Sheet</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          The source of truth for this project's copy. Each <span className="text-ink-100">row is a variation</span> you name;
          each <span className="text-ink-100">column is a layer</span> of the artwork. Formats are set in the project brief — a row renders in each of them.
        </p>
      </div>

      <JourneyNav campaignId={campaign.id} current="copy" progress={journeyProgress(campaign.id)} />

      <CopySheet
        campaignId={campaign.id}
        slug={brand.slug}
        schema={schema}
        initialRows={rows}
        initialDesigns={initialDesigns}
        references={listReferences(brand.id).map((r) => ({ id: r.id, label: r.label, file_path: r.file_path, mime: r.mime, kind: r.kind }))}
      />
    </div>
  );
}
