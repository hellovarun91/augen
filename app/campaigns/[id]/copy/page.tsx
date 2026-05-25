import { Eyebrow } from "@/components/ui/primitives";
import { getCampaign, getBrand, getProjectCopySchema, syncCopyRowsForCampaign, listGenerationsByCampaign, getProjectSizes } from "@/lib/repo";
import { formatBySlug, sizeOptions } from "@/lib/formats";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SyncActiveBrand } from "@/components/sync-active-brand";
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
  const sizes = getProjectSizes(campaign.id);
  const generations = listGenerationsByCampaign(campaign.id).map((g) => {
    const f = formatBySlug(g.format_slug);
    const hl = (g.headline || "").replace(/\s+/g, " ").trim().slice(0, 28);
    return { id: g.id, label: `${f?.name || g.format_slug}${hl ? ` · "${hl}"` : ""}` };
  });

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-[1400px] mx-auto space-y-6">
      <SyncActiveBrand brandId={brand.id} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link href={`/campaigns/${campaign.id}`} className="text-xs text-ink-400 hover:text-ink-100">← {campaign.name}</Link>
          <h1 className="serif text-display-lg mt-2 tracking-tight">Copy Sheet</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            The source of truth for this project's copy. Each <span className="text-ink-100">row is a variation</span> (give it a name);
            each <span className="text-ink-100">column is a layer</span> of the artwork. A row renders in every size you pick — same copy, every format.
          </p>
        </div>
        <Link href={`/brands/${brand.slug}/copy`} className="text-xs text-ink-300 hover:text-white whitespace-nowrap">Edit brand default columns →</Link>
      </div>

      <CopySheet campaignId={campaign.id} slug={brand.slug} schema={schema} initialRows={rows} generations={generations} sizes={sizes} sizeOptions={sizeOptions()} />
    </div>
  );
}
