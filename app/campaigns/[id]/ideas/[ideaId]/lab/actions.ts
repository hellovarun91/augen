"use server";
import { getBrand, getIdea, getCampaign, createCopyVariant, starCopyVariant, deleteCopyVariant } from "@/lib/repo";
import { runCopywriter } from "@/lib/agents/copywriter";
import { recordRun, newChainId } from "@/lib/agents/persistence";
import { revalidatePath } from "next/cache";

export async function spinVariantsAction(
  campaignId: string,
  ideaId: string,
  opts: { formatSlug: string; count: number; constraint?: string; carryForward?: string[] },
) {
  const campaign = getCampaign(campaignId);
  const idea = getIdea(ideaId);
  if (!campaign || !idea) throw new Error("Campaign or idea missing");
  const brand = getBrand(campaign.brand_id);
  if (!brand) throw new Error("Brand missing");

  const chainId = newChainId();
  const run = await recordRun({
    kind: "copywriter",
    chainId,
    brandId: brand.id,
    campaignId,
    ideaId,
    provider: { name: "mock", model: "augen-mock@1" },
    input: { formatSlug: opts.formatSlug, count: opts.count, constraint: opts.constraint, carryForward: opts.carryForward?.length || 0 },
    fn: () => runCopywriter({
      brand,
      language: brand.language,
      idea,
      product: campaign.brief.productFocus[0],
      formatSlug: opts.formatSlug,
      variantIndex: Math.floor(Math.random() * 100),
      count: opts.count,
      constraints: opts.constraint,
      carryForward: opts.carryForward,
    }),
  });

  for (const v of run.output.variants) {
    createCopyVariant({
      ideaId,
      headline: v.headline,
      subhead: v.subhead,
      cta: v.cta,
      eyebrow: v.eyebrow,
      note: opts.constraint || undefined,
      source: opts.constraint ? "ai:constraint" : "ai",
    });
  }

  revalidatePath(`/campaigns/${campaignId}/ideas/${ideaId}/lab`);
  return { count: run.output.variants.length, chainId };
}

export async function starVariantAction(variantId: string, starred: boolean) {
  starCopyVariant(variantId, starred);
  revalidatePath("/campaigns/[id]/ideas/[ideaId]/lab", "page");
}

export async function deleteVariantAction(variantId: string) {
  deleteCopyVariant(variantId);
  revalidatePath("/campaigns/[id]/ideas/[ideaId]/lab", "page");
}
