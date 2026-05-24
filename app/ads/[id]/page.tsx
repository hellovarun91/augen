import { Badge, Eyebrow } from "@/components/ui/primitives";
import { getBrand, getCampaign, getGeneration, getGenerationOverrides, getIdea, listAssets, listComments, listReviews } from "@/lib/repo";
import { listMembershipsForBrand } from "@/lib/users";
import { getSession } from "@/lib/session";
import { formatBySlug } from "@/lib/formats";
import { notFound } from "next/navigation";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";
import { parseOverrides } from "@/lib/composer/overrides";
import { AdDetailClient } from "./detail-client";
import { CommentThread } from "@/components/comment-thread";
import { VisualQC } from "@/components/visual-qc";
import { Card, Section } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gen = getGeneration(id);
  if (!gen) notFound();
  const brand = getBrand(gen.brand_id)!;
  const campaign = getCampaign(gen.campaign_id)!;
  const idea = gen.idea_id ? getIdea(gen.idea_id) : null;
  const fmt = formatBySlug(gen.format_slug);
  const overrides = parseOverrides(getGenerationOverrides(id));
  const { user } = await getSession();
  const members = listMembershipsForBrand(brand.id).map((m) => ({ id: m.user_id, name: m.user.name, color: m.user.avatar_color }));
  const comments = listComments("creative", gen.id);
  const reviews = listReviews(gen.id);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-8">
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
              copy {(gen.confidence * 100).toFixed(0)}
            </Badge>
            {gen.design_score != null && (
              <Badge tone={gen.design_score > 0.85 ? "ok" : gen.design_score > 0.6 ? "warn" : "danger"}>
                design {(gen.design_score * 100).toFixed(0)}
              </Badge>
            )}
            <Badge tone={gen.status === "approved" ? "ok" : gen.status === "rejected" ? "danger" : gen.status === "needs_revision" ? "warn" : "info"}>
              {gen.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
      </div>

      <AdDetailClient
        generation={{
          id: gen.id,
          width: gen.width,
          height: gen.height,
          headline: gen.headline,
          subhead: gen.subhead || "",
          cta: gen.cta,
          eyebrow: gen.eyebrow || "",
          status: gen.status,
          imagePrompt: gen.image_prompt || "",
          copyVariants: gen.copy.length,
          isWinner: (gen as any).is_winner === 1,
        }}
        overrides={overrides}
        tokens={brand.tokens}
        ideaSummary={idea ? { theme: idea.theme, angle: idea.angle, audience: idea.audience, insight: idea.insight || "" } : null}
        assets={listAssets(brand.id).map((a) => ({ id: a.id, label: a.label, file_path: a.file_path, kind: a.kind }))}
      />

      <Section title="Visual QC" subtitle="A design critic that scores the rendered creative — legibility, contrast, composition, safe area, brand fit.">
        <Card className="p-5">
          <VisualQC id={gen.id} initialScore={gen.design_score} initialNotes={gen.design_notes} />
        </Card>
      </Section>

      {reviews.length > 0 && (
        <Section title="Review history" subtitle="Who decided what, and when.">
          <Card className="p-0 overflow-hidden">
            <ul>
              {reviews.map((r) => {
                const tone = r.action === "approved" ? "ok" : r.action === "rejected" ? "danger" : r.action === "needs_revision" ? "warn" : "neutral";
                return (
                  <li key={r.id} className="flex items-start gap-3 px-5 py-3 border-b border-white/5 last:border-b-0">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5" style={{ background: r.reviewer_color, color: "#0A0A0B" }}>
                      {r.reviewer_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-ink-100">{r.reviewer_name}</span>
                        <Badge tone={tone as any}>{r.action.replace("_", " ")}</Badge>
                        <span className="text-ink-500">{relativeDate(r.created_at)}</span>
                      </div>
                      {r.note && <p className="text-sm text-ink-300 mt-1 whitespace-pre-wrap">{r.note}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </Section>
      )}

      <Section title="Discussion" subtitle="Feedback on this creative — @mention a teammate.">
        <Card className="p-5">
          <CommentThread brandId={brand.id} targetType="creative" targetId={gen.id} members={members} currentUserId={user?.id || null} initial={comments} />
        </Card>
      </Section>
    </div>
  );
}
