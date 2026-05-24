import { Eyebrow } from "@/components/ui/primitives";
import { getBrandBySlug } from "@/lib/repo";
import { listMembershipsForBrand } from "@/lib/users";
import { getSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { TeamManager } from "./team";

export const dynamic = "force-dynamic";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const { user } = await getSession();
  const members = listMembershipsForBrand(brand.id).map((m) => ({
    id: m.id, role: m.role, name: m.user.name, email: m.user.email,
    color: m.user.avatar_color, isSelf: m.user.id === user?.id,
  }));

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-3xl mx-auto space-y-8">
      <SyncActiveBrand brandId={brand.id} />
      <div>
        <Eyebrow>{brand.name} · team</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Team</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Bring the people who shape this brand into one place — manager, copywriters, designers, marketers, stakeholders.
          Multiple brains on one project; everyone works against the same brand, copy, and creatives.
        </p>
      </div>
      <TeamManager brandId={brand.id} members={members} />
    </div>
  );
}
