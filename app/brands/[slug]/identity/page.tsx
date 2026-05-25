import { Eyebrow } from "@/components/ui/primitives";
import { getBrandBySlug, brandRole } from "@/lib/repo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { IdentityEditor } from "./form";
import { DeleteBrand } from "./danger";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function IdentityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const { user } = await getSession();
  const isOwner = !!user && brandRole(user.id, brand.id) === "owner";

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-3xl mx-auto space-y-8">
      <SyncActiveBrand brandId={brand.id} />
      <div>
        <Link href={`/brands/${brand.slug}`} className="text-xs text-ink-400 hover:text-ink-100">← {brand.name}</Link>
        <Eyebrow className="mt-3">Manage · identity</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Brand identity</h1>
        <p className="text-ink-300 mt-2">The name, line, and description every agent reads first. Edit anytime — it feeds the whole studio.</p>
      </div>
      <IdentityEditor brand={{
        id: brand.id, name: brand.name, tagline: brand.tagline || "",
        industry: brand.industry || "", description: brand.description || "",
      }} />

      {isOwner && <DeleteBrand brandId={brand.id} name={brand.name} />}
    </div>
  );
}
