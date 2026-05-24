import { Badge, Eyebrow } from "@/components/ui/primitives";
import { getBrand, getCampaign, getGeneration, getGenerationOverrides, getIdea, listAssets, listComments } from "@/lib/repo";
import { listMembershipsForBrand } from "@/lib/users";
import { getSession } from "@/lib/session";
import { formatBySlug } from "@/lib/formats";
import { notFound } from "next/navigation";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";
import { parseOverrides } from "@/lib/composer/overrides";
import { AdDetailClient } from "./detail-client";
import { CommentThread } from "@/components/comment-thread";
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
              confidence {(gen.confidence * 100).toFixed(0)}
            </Badge>
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

      <Section title="Discussion" subtitle="Feedback on this creative — @mention a teammate.">
        <Card className="p-5">
          <CommentThread brandId={brand.id} targetType="creative" targetId={gen.id} members={members} currentUserId={user?.id || null} initial={comments} />
        </Card>
      </Section>
    </div>
  );
}
