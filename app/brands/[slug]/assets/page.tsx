import { Eyebrow } from "@/components/ui/primitives";
import { getBrandBySlug, listAssets } from "@/lib/repo";
import { notFound } from "next/navigation";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { AssetManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function AssetsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const assets = listAssets(brand.id);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-8">
      <SyncActiveBrand brandId={brand.id} />
      <div>
        <Eyebrow>{brand.name} · brand kit</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Assets</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Reusable brand graphics — logo, marks, icons, badges — composited into ads as-is. Mark a <span className="text-ink-100">primary</span> logo
          (and an <span className="text-ink-100">inverse</span> for dark backgrounds) and every generated ad carries it.
        </p>
      </div>
      <AssetManager brandId={brand.id} slug={brand.slug} assets={assets} />
    </div>
  );
}
