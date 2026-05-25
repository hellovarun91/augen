import type { Brand, BrandLanguage, CampaignBrief, Idea } from "@/lib/types";
import { recordRun, newChainId } from "./persistence";
import { runStrategist } from "./strategist";
import { runArtDirector } from "./art-director";
import { runCopywriter } from "./copywriter";
import { runCriticBatch } from "./critic";
import type { ArtDirectorOutput, CopywriterOutput, CopyVariant, CriticOutput } from "./types";
import { formatBySlug, type FormatSpec } from "@/lib/formats";
import { chargeBilling, createGeneration, createIdea, listIdeas, setCampaignStatus, getBilling, listReferences, updateGenerationReference, createReference, recordVisionReview, recordAgentRevision } from "@/lib/repo";
import { generateImage, saveBytes } from "@/lib/images/providers";
import type { AgentProvider } from "./types";
import { claudeModel, getClaude } from "./adapters/claude";
import { recordSpend } from "@/lib/spend";
import { imagePriceMicros } from "./pricing";
import { runVisionCritic } from "./vision-critic";

// Vision QC inline in bulk generation is opt-in (cost + latency per ad).
const VISION_QC_INLINE = /^(1|true|on|yes)$/i.test(process.env.AUGEN_VISION_QC || "");
// Agentic revise loop: re-write ads the critic flags "revise". On by default
// (only fires on weak ads, one pass); set AUGEN_REVISE=0 to disable.
const REVISE_ENABLED = !/^(0|false|off|no)$/i.test(process.env.AUGEN_REVISE || "");
const REVISE_MAX = (() => { const v = parseInt(process.env.AUGEN_REVISE_MAX || "", 10); return Number.isFinite(v) && v > 0 ? v : 12; })();

function currentProvider(): AgentProvider {
  return getClaude()
    ? { name: "claude", model: claudeModel() }
    : { name: "mock", model: "augen-mock@1" };
}
const COST_PER_AD_CENTS = 16;

// How many ads the QC Critic scores per Claude call. The brand context is cached,
// so a chunk costs roughly one ad's worth of input regardless of size.
const CRITIC_BATCH_SIZE = (() => {
  const v = parseInt(process.env.AUGEN_CRITIC_BATCH || "", 10);
  return Number.isFinite(v) && v > 0 ? v : 8;
})();

export interface GenerateChainResult {
  chainId: string;
  generations: number;
  strategistRunId?: string;
  copyRunIds: string[];
  artRunIds: string[];
  criticRunIds: string[];
}

export async function generateAdsViaAgents(args: {
  campaignId: string;
  brand: Brand;
  brief: CampaignBrief;
  variantsPerFormat?: number;
  copyConstraint?: string;
  userId?: string;
  baseUrl?: string; // origin for rendering composites (inline vision QC)
}): Promise<GenerateChainResult> {
  const ideas = listIdeas(args.campaignId);
  if (!ideas.length) {
    throw new Error("No ideas — run the Strategist or write ideas first.");
  }
  const allRefs = listReferences(args.brand.id).filter((r) => r.selected);
  const refs = allRefs.map((r) => r.label || r.file_path || r.source);
  const variantsPerFormat = args.variantsPerFormat || 1;
  const chainId = newChainId();
  setCampaignStatus(args.campaignId, "generating");

  const provider = currentProvider();
  const copyRunIds: string[] = [];
  const artRunIds: string[] = [];
  const criticRunIds: string[] = [];

  // ---- Phase 1: Art Director + Copywriter per ad. Defer critique so it batches.
  type PendingAd = {
    idea: Idea;
    fmt: FormatSpec;
    formatSlug: string;
    v: number;
    product: string;
    art: ArtDirectorOutput;
    variants: CopyVariant[];
    chosen: CopyVariant;
    revised?: boolean;
  };
  const pending: PendingAd[] = [];

  for (const idea of ideas.filter((i) => i.selected)) {
    for (const formatSlug of args.brief.formats) {
      const fmt = formatBySlug(formatSlug);
      if (!fmt) continue;
      for (let v = 0; v < variantsPerFormat; v++) {
        const product = args.brief.productFocus[pending.length % Math.max(1, args.brief.productFocus.length)] || args.brand.name;

        const art = await recordRun({
          kind: "art_director",
          chainId,
          brandId: args.brand.id,
          campaignId: args.campaignId,
          ideaId: idea.id,
          userId: args.userId,
          provider,
          input: { brandSlug: args.brand.slug, idea: idea.theme, product, formatSlug, variantIndex: v },
          fn: () => runArtDirector({
            brand: args.brand,
            idea,
            product,
            formatSlug,
            aspect: fmt.aspect,
            variantIndex: v,
            referencePool: refs,
          }),
        });
        artRunIds.push(art.runId);

        const copy = await recordRun({
          kind: "copywriter",
          chainId,
          parentRunId: art.runId,
          brandId: args.brand.id,
          campaignId: args.campaignId,
          ideaId: idea.id,
          userId: args.userId,
          provider,
          input: { idea: idea.theme, product, formatSlug, count: 3, constraint: args.copyConstraint },
          fn: () => runCopywriter({
            brand: args.brand,
            language: args.brand.language,
            idea,
            product,
            formatSlug,
            variantIndex: v,
            count: 3,
            constraints: args.copyConstraint,
          }),
        });
        copyRunIds.push(copy.runId);

        pending.push({ idea, fmt, formatSlug, v, product, art: art.output, variants: copy.output.variants, chosen: copy.output.variants[0] });
      }
    }
  }

  // ---- Phase 2: batch critique in chunks. One Claude call scores up to
  // CRITIC_BATCH_SIZE ads against the (cached) brand context.
  const critiques: CriticOutput[] = new Array(pending.length);
  for (let start = 0; start < pending.length; start += CRITIC_BATCH_SIZE) {
    const slice = pending.slice(start, start + CRITIC_BATCH_SIZE);
    const batch = await recordRun({
      kind: "critic",
      chainId,
      brandId: args.brand.id,
      campaignId: args.campaignId,
      userId: args.userId,
      provider,
      input: { batch: slice.map((p) => ({ formatSlug: p.formatSlug, copy: p.chosen, idea: p.idea.theme })) },
      fn: () => runCriticBatch({
        brand: args.brand,
        language: args.brand.language,
        items: slice.map((p) => ({ formatSlug: p.formatSlug, copy: p.chosen, idea: p.idea })),
      }),
    });
    criticRunIds.push(batch.runId);
    batch.output.critiques.forEach((c, j) => { critiques[start + j] = c; });
  }

  // ---- Phase 2b: bounded agentic revise loop. For ads the critic flagged
  // "revise", re-run the Copywriter with the revision note as a constraint, then
  // re-critique just those — so the chain self-corrects before anything ships.
  if (REVISE_ENABLED) {
    const toRevise: number[] = [];
    for (let i = 0; i < pending.length; i++) {
      const c = critiques[i];
      if (c && c.verdict === "revise" && c.revisionNote && toRevise.length < REVISE_MAX) toRevise.push(i);
    }
    if (toRevise.length) {
      for (const i of toRevise) {
        const p = pending[i];
        const note = critiques[i].revisionNote!;
        const constraint = [args.copyConstraint, `Revision: ${note}`].filter(Boolean).join(" — ");
        const recopy = await recordRun({
          kind: "copywriter",
          chainId,
          brandId: args.brand.id,
          campaignId: args.campaignId,
          ideaId: p.idea.id,
          userId: args.userId,
          provider,
          input: { idea: p.idea.theme, product: p.product, formatSlug: p.formatSlug, count: 3, constraint, revise: true },
          fn: () => runCopywriter({ brand: args.brand, language: args.brand.language, idea: p.idea, product: p.product, formatSlug: p.formatSlug, variantIndex: p.v, count: 3, constraints: constraint }),
        });
        copyRunIds.push(recopy.runId);
        pending[i] = { ...p, variants: recopy.output.variants, chosen: recopy.output.variants[0], revised: true };
      }
      // Re-score only the revised ads, in one batch, and replace their critiques.
      const reBatch = await recordRun({
        kind: "critic",
        chainId,
        brandId: args.brand.id,
        campaignId: args.campaignId,
        userId: args.userId,
        provider,
        input: { revised: toRevise.length },
        fn: () => runCriticBatch({
          brand: args.brand,
          language: args.brand.language,
          items: toRevise.map((i) => ({ formatSlug: pending[i].formatSlug, copy: pending[i].chosen, idea: pending[i].idea })),
        }),
      });
      criticRunIds.push(reBatch.runId);
      reBatch.output.critiques.forEach((c, j) => { critiques[toRevise[j]] = c; });
    }
  }

  // ---- Phase 3: persist each generation, bill, and resolve a reference image.
  let count = 0;
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    const critique = critiques[i] ?? { score: 0.7, voiceFit: 0.7, formatFit: 0.7, conceptStrength: 0.7, verdict: "revise" as const, notes: [] };

    const gen = createGeneration({
      campaignId: args.campaignId,
      ideaId: p.idea.id,
      brandId: args.brand.id,
      formatSlug: p.formatSlug,
      aspect: p.fmt.aspect,
      width: p.fmt.width,
      height: p.fmt.height,
      headline: p.chosen.headline,
      subhead: p.chosen.subhead,
      cta: p.chosen.cta,
      eyebrow: p.chosen.eyebrow,
      copy: p.variants,
      imagePrompt: p.art.imagePrompt,
      imageSeed: p.art.seed,
      imageStyle: p.art.styleKeyword,
      palette: p.art.paletteEmphasis,
      confidence: critique.score,
      costCents: COST_PER_AD_CENTS,
    });

    // Mock billing
    if (getBilling(args.brand.id)) {
      chargeBilling(args.brand.id, COST_PER_AD_CENTS, `Generation · ${p.fmt.name}`, gen.id);
    }

    // Note any auto-revision in the review timeline (trust + traceability).
    if (p.revised) recordAgentRevision(gen.id, "Copy auto-revised on the critic's note, then re-scored.");

    // Resolve a reference image for this generation.
    // Priority: pre-loaded library refs (round-robin) > Gemini fresh generation > SVG fallback.
    if (allRefs.length) {
      const pickRef = allRefs[count % allRefs.length];
      if (pickRef.file_path) updateGenerationReference(gen.id, pickRef.id);
    } else if (process.env.GEMINI_API_KEY) {
      const img = await generateImage(p.art.imagePrompt, p.fmt.aspect);
      if (img) {
        recordSpend({
          userId: args.userId, brandId: args.brand.id, campaignId: args.campaignId, generationId: gen.id,
          provider: "gemini", category: "image", model: img.source, qty: 1, costMicros: imagePriceMicros(),
        });
        const saved = await saveBytes(args.brand.slug, img.bytes, img.mime);
        const ref = createReference({
          brandId: args.brand.id,
          kind: "generated",
          source: "gemini",
          label: `Generated · ${p.idea.theme.slice(0, 40)} · ${p.fmt.aspect}`,
          prompt: p.art.imagePrompt,
          filePath: saved.publicPath,
          mime: img.mime,
          width: img.width,
          height: img.height,
          tags: [p.fmt.aspect, "gemini", `seed:${p.art.seed}`],
        });
        updateGenerationReference(gen.id, ref.id);
      }
    }

    // ---- Optional inline Vision QC: score the rendered composite (design, not
    // just copy). Opt-in via AUGEN_VISION_QC; needs a base URL to render the PNG.
    if (VISION_QC_INLINE && args.baseUrl) {
      try {
        const res = await fetch(`${args.baseUrl}/api/render/${gen.id}/png`, { cache: "no-store" });
        if (res.ok) {
          const png = { bytes: Buffer.from(await res.arrayBuffer()), mime: "image/png" };
          const { output } = await runVisionCritic({
            brand: args.brand, language: args.brand.language, formatSlug: p.formatSlug,
            copy: { eyebrow: p.chosen.eyebrow, headline: p.chosen.headline, subhead: p.chosen.subhead, cta: p.chosen.cta },
            png,
          });
          recordVisionReview(gen.id, { score: output.overallScore, verdict: output.verdict, notes: output.notes, fixes: output.fixes });
        }
      } catch { /* non-fatal — design score stays unset */ }
    }

    count++;
  }

  setCampaignStatus(args.campaignId, "ready_for_review");
  return { chainId, generations: count, copyRunIds, artRunIds, criticRunIds };
}

export async function strategistOnly(args: {
  campaignId: string;
  brand: Brand;
  brief: CampaignBrief;
  language: BrandLanguage;
  quarter?: string;
  year?: number;
  notes?: string;
  count: number;
  userId?: string;
}): Promise<{ chainId: string; runId: string; ideaCount: number }> {
  const chainId = newChainId();
  const run = await recordRun({
    kind: "strategist",
    chainId,
    brandId: args.brand.id,
    campaignId: args.campaignId,
    userId: args.userId,
    provider: currentProvider(),
    input: { brief: args.brief, quarter: args.quarter, year: args.year, count: args.count, notes: args.notes },
    fn: () => runStrategist({
      brand: args.brand,
      language: args.language,
      brief: args.brief,
      quarter: args.quarter,
      year: args.year,
      count: args.count,
      notes: args.notes,
    }),
  });

  let idx = 0;
  for (const idea of run.output.ideas) {
    createIdea({
      campaignId: args.campaignId,
      theme: idea.theme,
      insight: idea.insight,
      angle: idea.angle,
      audience: idea.audience,
      promise: idea.promise,
      hooks: idea.hooks,
      visualDirection: idea.visualDirection,
      orderIdx: idx++,
    });
  }

  return { chainId, runId: run.runId, ideaCount: run.output.ideas.length };
}
