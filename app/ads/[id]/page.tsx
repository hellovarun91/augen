import { Badge, Card, Eyebrow, Section } from "@/components/ui/primitives";
import { getBrand, getCampaign, getGeneration, getIdea } from "@/lib/repo";
import { formatBySlug } from "@/lib/formats";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdPreview } from "@/components/ad-preview";
import { ReviewControls } from "./controls";
import { relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gen = getGeneration(id);
  if (!gen) notFound();
  const brand = getBrand(gen.brand_id)!;
  const campaign = getCampaign(gen.campaign_id)!;
  const idea = gen.idea_id ? getIdea(gen.idea_id) : null;
  const fmt = formatBySlug(gen.format_slug);

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto space-y-10">
      <div>
        <Link href={`/campaigns/${campaign.id}`} className="text-xs text-ink-400 hover:text-ink-100">← {campaign.name}</Link>
        <div className="flex items-end justify-between gap-6 mt-2">
          <div>
            <Eyebrow>{brand.name} · {fmt?.platform} · {fmt?.placement}</Eyebrow>
            <h1 className="serif text-display-lg mt-1 tracking-tight">{fmt?.name}</h1>
            <div className="text-ink-300 mt-1">{gen.width}×{gen.height} · seed {gen.image_seed} · {relativeDate(gen.created_at)}</div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={gen.confidence > 0.85 ? "ok" : gen.confidence > 0.7 ? "warn" : "danger"}>
              confidence {(gen.confidence * 100).toFixed(0)}
            </Badge>
            <Badge tone={gen.status === "approved" ? "ok" : gen.status === "rejected" ? "danger" : gen.status === "needs_revision" ? "warn" : "info"}>
              {gen.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr,420px] gap-8">
        <div className="space-y-4">
          <AdPreview generationId={gen.id} width={gen.width} height={gen.height} className="max-w-full" />
          <Card className="p-4">
            <Eyebrow>Variants</Eyebrow>
            <div className="grid grid-cols-3 gap-3 mt-3">
              {gen.copy.map((_, i) => (
                <div key={i} className="space-y-1">
                  <AdPreview generationId={gen.id} width={gen.width} height={gen.height} variant={`v${i}`} className="!rounded-md" />
                  <div className="text-[11px] text-ink-400 text-center">Variant {i + 1}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <Eyebrow>Copy</Eyebrow>
            <div className="serif text-2xl mt-2 whitespace-pre-line tracking-tight">{gen.headline}</div>
            {gen.subhead && <p className="text-ink-200 mt-2 text-sm">{gen.subhead}</p>}
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-ink-400">CTA</div>
              <div className="text-sm text-ink-100">{gen.cta} →</div>
            </div>
          </Card>

          <ReviewControls
            generationId={gen.id}
            status={gen.status}
            initial={{ headline: gen.headline, subhead: gen.subhead || "", cta: gen.cta, eyebrow: gen.eyebrow || "" }}
            isWinner={(gen as any).is_winner === 1}
          />

          <Card className="p-5 space-y-3">
            <Eyebrow>Image prompt</Eyebrow>
            <pre className="text-[11px] text-ink-300 whitespace-pre-wrap font-mono leading-relaxed">{gen.image_prompt}</pre>
          </Card>

          {idea && (
            <Card className="p-5">
              <Eyebrow>From idea</Eyebrow>
              <div className="serif text-lg mt-1">{idea.theme}</div>
              <div className="text-xs text-ink-400 mt-1">{idea.angle} · {idea.audience}</div>
              {idea.insight && <p className="text-sm text-ink-200 mt-2">{idea.insight}</p>}
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
