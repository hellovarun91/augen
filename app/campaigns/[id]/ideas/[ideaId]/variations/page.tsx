import { Badge, Card, Empty, Eyebrow, LinkButton, Section } from "@/components/ui/primitives";
import { getBrand, getCampaign, getIdea, listReferences } from "@/lib/repo";
import { listVariationBatches } from "@/lib/variations";
import { notFound } from "next/navigation";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";
import { MatrixEditor } from "./matrix-editor";
import { CsvImport } from "./csv-import";
import { defaultFormatSlugs, formatsByPlatform } from "@/lib/formats";

export const dynamic = "force-dynamic";

export default async function VariationsPage({ params }: { params: Promise<{ id: string; ideaId: string }> }) {
  const { id, ideaId } = await params;
  const campaign = getCampaign(id);
  const idea = getIdea(ideaId);
  if (!campaign || !idea) notFound();
  const brand = getBrand(campaign.brand_id);
  if (!brand) notFound();

  const batches = listVariationBatches(idea.id);
  const refs = listReferences(brand.id);
  const groupedFormats = formatsByPlatform();
  const defaultFormats = defaultFormatSlugs();

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto space-y-10">
      <div>
        <Link href={`/campaigns/${campaign.id}`} className="text-xs text-ink-400 hover:text-ink-100">← {campaign.name}</Link>
        <div className="flex items-end justify-between gap-6 mt-2">
          <div>
            <Eyebrow>Variations · {idea.theme}</Eyebrow>
            <h1 className="serif text-display-lg mt-1 tracking-tight">Sheet-style ad variations.</h1>
            <p className="text-ink-300 mt-2 max-w-2xl">
              List headline, subhead, CTA, eyebrow, and image options for this idea. Augen cross-products them — or zips them row-by-row — into one
              generation per combination per selected format. <span className="text-emerald-300">Zero credits</span>. Output flows through the
              same review queue, deliverables view, and export bundle as agent ads.
            </p>
          </div>
        </div>
      </div>

      <Section title="Build a new batch" subtitle="Two ways in: visual matrix editor or paste a CSV.">
        <div className="grid lg:grid-cols-[1fr,420px] gap-5">
          <MatrixEditor
            campaignId={campaign.id}
            ideaId={idea.id}
            references={refs.map((r) => ({ id: r.id, label: r.label || r.prompt || r.source, filePath: r.file_path }))}
            groupedFormats={groupedFormats}
            defaultFormats={defaultFormats}
          />
          <CsvImport campaignId={campaign.id} ideaId={idea.id} groupedFormats={groupedFormats} defaultFormats={defaultFormats} />
        </div>
      </Section>

      <Section title={`Batches — ${batches.length}`}>
        {batches.length === 0 ? (
          <Empty title="No variation batches yet">Build one above to start.</Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {batches.map((b) => (
              <Link key={b.id} href={`/campaigns/${campaign.id}/ideas/${idea.id}/variations/${b.id}`}>
                <Card className="p-5 hover:bg-ink-800 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="serif text-xl tracking-tight">{b.name}</div>
                      <div className="text-xs text-ink-400 mt-1">{relativeDate(b.created_at)} · {b.strategy}</div>
                    </div>
                    <Badge>{b.generations_count} ads</Badge>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mt-4 text-xs">
                    <div><Eyebrow>H</Eyebrow><div className="text-ink-200 mt-1">{b.slots.headline.length}</div></div>
                    <div><Eyebrow>S</Eyebrow><div className="text-ink-200 mt-1">{b.slots.subhead.length}</div></div>
                    <div><Eyebrow>CTA</Eyebrow><div className="text-ink-200 mt-1">{b.slots.cta.length}</div></div>
                    <div><Eyebrow>Eyebrow</Eyebrow><div className="text-ink-200 mt-1">{b.slots.eyebrow.length}</div></div>
                    <div><Eyebrow>Img</Eyebrow><div className="text-ink-200 mt-1">{b.slots.imageRefIds.length}</div></div>
                  </div>
                  <div className="text-[11px] text-ink-400 mt-3">Formats: {b.formats.join(" · ")}</div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="CSV format">
        <Card className="p-5">
          <pre className="text-[11px] text-ink-300 leading-relaxed">{`headline,subhead,cta,eyebrow,image_ref_id
"Begin with Tanda.","Wild fermented. Low sugar.","Find a store","FIELD-TESTED",
"Made for the second cup.","Made by feel.","Order today","JUST IN",ref_xxx
"Quietly correct.","Designed to be the default.","Subscribe & save","STUDIO RELEASE",`}</pre>
          <div className="text-xs text-ink-400 mt-3">
            <code className="text-ink-200">image_ref_id</code> is optional. Leave blank to use the SVG composer background. Find ref IDs in the brand References page (URL contains the ID).
          </div>
        </Card>
      </Section>
    </div>
  );
}
