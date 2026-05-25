import { Card, Eyebrow, Section } from "@/components/ui/primitives";
import { getBrandBySlug } from "@/lib/repo";
import { notFound } from "next/navigation";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { PlannerClient } from "./controls";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-8">
      <SyncActiveBrand brandId={brand.id} />
      <div>
        <Eyebrow>{brand.name} · AI planner</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Turn a goal into projects</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Tell the planner what you're working toward — a launch, a seasonal push, an offer — and it drafts a few
          build-ready projects in {brand.name}'s voice. Keep the ones you like; each becomes a Project you generate ads in.
        </p>
      </div>

      <PlannerClient brandId={brand.id} />

      <Section title="How it works">
        <Card className="p-6 grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <Eyebrow>1 · Say the goal</Eyebrow>
            <p className="text-ink-200 mt-2">Plain language is fine — "spring launch, push samples." The planner reads your brand's voice and audience alongside it.</p>
          </div>
          <div>
            <Eyebrow>2 · Shape the drafts</Eyebrow>
            <p className="text-ink-200 mt-2">It proposes a few projects with idea seeds. Rename, drop, add your own, or ask for a different set — nothing is committed yet.</p>
          </div>
          <div>
            <Eyebrow>3 · Send to Studio</Eyebrow>
            <p className="text-ink-200 mt-2">Add the keepers and they become real Projects, ready for you to generate and review ads inside.</p>
          </div>
        </Card>
      </Section>
    </div>
  );
}
