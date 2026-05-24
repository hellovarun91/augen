import { Eyebrow } from "@/components/ui/primitives";
import { getBrandBySlug, getCopySchema } from "@/lib/repo";
import { notFound } from "next/navigation";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { CopySchemaEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function CopyStructurePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const schema = getCopySchema(brand.id);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-4xl mx-auto space-y-8">
      <SyncActiveBrand brandId={brand.id} />
      <div>
        <Eyebrow>{brand.name} · copy structure</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Copy structure</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          The fields this brand's copy is organized into — its columns in the Copy Sheet. Import the doc your team already keeps and Augen
          reads the structure (CTA, headline, regional offers, image copy, emailer…); edit it to taste. Each brand has its own.
        </p>
      </div>
      <CopySchemaEditor brandId={brand.id} slug={brand.slug} initial={schema} />
    </div>
  );
}
