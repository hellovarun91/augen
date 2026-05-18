import { Badge, Card, Empty, Eyebrow, Section } from "@/components/ui/primitives";
import { getBrand, getCampaign, getIdea, listCopyVariants } from "@/lib/repo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LabControls, VariantList } from "./controls";

export const dynamic = "force-dynamic";

export default async function CopyLabPage({ params }: { params: Promise<{ id: string; ideaId: string }> }) {
  const { id, ideaId } = await params;
  const campaign = getCampaign(id);
  const idea = getIdea(ideaId);
  if (!campaign || !idea) notFound();
  const brand = getBrand(campaign.brand_id);
  if (!brand) notFound();

  const variants = listCopyVariants(idea.id);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-10">
      <div>
        <Link href={`/campaigns/${campaign.id}`} className="text-xs text-ink-400 hover:text-ink-100">← {campaign.name}</Link>
        <div className="mt-2 flex items-end justify-between gap-6">
          <div>
            <Eyebrow>Copy Lab · {idea.angle}</Eyebrow>
            <h1 className="serif text-display-lg mt-1 tracking-tight">{idea.theme}</h1>
            <p className="text-ink-300 mt-2 max-w-2xl">{idea.insight}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge tone="info">{idea.audience}</Badge>
            <Badge>{variants.length} variants saved</Badge>
          </div>
        </div>
      </div>

      <Section title="Spin variants" subtitle="The Copywriter agent listens to constraints — try 'shorter', 'lead with benefit', 'less precious', 'category counterpoint'.">
        <LabControls
          campaignId={campaign.id}
          ideaId={idea.id}
          brandId={brand.id}
          recentHeadlines={variants.slice(0, 12).map((v) => v.headline)}
        />
      </Section>

      <Section title="Saved variants" subtitle="Star a winner — those go into generation by default.">
        {variants.length === 0 ? (
          <Empty title="No variants yet">Press Spin variants above to draft a first batch.</Empty>
        ) : (
          <VariantList variants={variants} brandId={brand.id} limits={brand.language.copyLimits} />
        )}
      </Section>
    </div>
  );
}
