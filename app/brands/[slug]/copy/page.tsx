import { Eyebrow } from "@/components/ui/primitives";
import { getBrandBySlug, getCopySchema } from "@/lib/repo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { CopySchemaEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function CopyStructurePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> }) {
  const { slug } = await params;
  const { from } = await searchParams;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const schema = getCopySchema(brand.id);
  // Only honour same-app project return paths (avoid open-redirect surface).
  const backToSheet = from && /^\/campaigns\/[A-Za-z0-9_-]+\/copy$/.test(from) ? from : null;

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-4xl mx-auto space-y-8">
      <SyncActiveBrand brandId={brand.id} />
      <div>
        {backToSheet
          ? <Link href={backToSheet} className="text-xs text-ink-400 hover:text-ink-100">← Back to Copy Sheet</Link>
          : <Link href={`/brands/${brand.slug}`} className="text-xs text-ink-400 hover:text-ink-100">← {brand.name}</Link>}
        <Eyebrow className="mt-3">{brand.name} · default</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Default copy structure</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          The reusable columns every new project's Copy Sheet starts from. Import the doc your team keeps and Augen reads the structure
          (CTA, headline, regional offers, image copy, emailer…); edit to taste. Each project can then add or drop columns of its own.
        </p>
      </div>
      <CopySchemaEditor brandId={brand.id} slug={brand.slug} initial={schema} />
    </div>
  );
}
