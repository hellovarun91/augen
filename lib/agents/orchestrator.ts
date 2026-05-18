import type { Brand, BrandLanguage, CampaignBrief, Idea } from "@/lib/types";
import { recordRun, newChainId } from "./persistence";
import { runStrategist } from "./strategist";
import { runArtDirector } from "./art-director";
import { runCopywriter } from "./copywriter";
import { runCritic } from "./critic";
import { formatBySlug } from "@/lib/formats";
import { chargeBilling, createGeneration, createIdea, listIdeas, setCampaignStatus, getBilling, listReferences, updateGenerationReference, createReference } from "@/lib/repo";
import { generateImage, saveBytes } from "@/lib/images/providers";
import type { AgentProvider } from "./types";
import { claudeModel, getClaude } from "./adapters/claude";

function currentProvider(): AgentProvider {
  return getClaude()
    ? { name: "claude", model: claudeModel() }
    : { name: "mock", model: "augen-mock@1" };
}
const COST_PER_AD_CENTS = 16;

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

  const copyRunIds: string[] = [];
  const artRunIds: string[] = [];
  const criticRunIds: string[] = [];
  let count = 0;

  for (const idea of ideas.filter((i) => i.selected)) {
    for (const formatSlug of args.brief.formats) {
      const fmt = formatBySlug(formatSlug);
      if (!fmt) continue;
      for (let v = 0; v < variantsPerFormat; v++) {
        const product = args.brief.productFocus[count % Math.max(1, args.brief.productFocus.length)] || args.brand.name;

        // Art Director
        const art = await recordRun({
          kind: "art_director",
          chainId,
          brandId: args.brand.id,
          campaignId: args.campaignId,
          ideaId: idea.id,
          provider: currentProvider(),
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

        // Copywriter
        const copy = await recordRun({
          kind: "copywriter",
          chainId,
          parentRunId: art.runId,
          brandId: args.brand.id,
          campaignId: args.campaignId,
          ideaId: idea.id,
          provider: currentProvider(),
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

        const chosen = copy.output.variants[0];

        // Critic
        const critique = await recordRun({
          kind: "critic",
          chainId,
          parentRunId: copy.runId,
          brandId: args.brand.id,
          campaignId: args.campaignId,
          ideaId: idea.id,
          provider: currentProvider(),
          input: { copy: chosen, formatSlug, idea: idea.theme },
          fn: () => runCritic({
            brand: args.brand,
            language: args.brand.language,
            copy: chosen,
            formatSlug,
            idea,
          }),
        });
        criticRunIds.push(critique.runId);

        // Persist the generation
        const gen = createGeneration({
          campaignId: args.campaignId,
          ideaId: idea.id,
          brandId: args.brand.id,
          formatSlug,
          aspect: fmt.aspect,
          width: fmt.width,
          height: fmt.height,
          headline: chosen.headline,
          subhead: chosen.subhead,
          cta: chosen.cta,
          eyebrow: chosen.eyebrow,
          copy: copy.output.variants,
          imagePrompt: art.output.imagePrompt,
          imageSeed: art.output.seed,
          imageStyle: art.output.styleKeyword,
          palette: art.output.paletteEmphasis,
          confidence: critique.output.score,
          costCents: COST_PER_AD_CENTS,
        });

        // Mock billing
        if (getBilling(args.brand.id)) {
          chargeBilling(args.brand.id, COST_PER_AD_CENTS, `Generation · ${fmt.name}`, gen.id);
        }

        // Resolve a reference image for this generation.
        // Priority: pre-loaded library refs (round-robin) > Gemini fresh generation > SVG fallback.
        if (allRefs.length) {
          const pickRef = allRefs[count % allRefs.length];
          if (pickRef.file_path) updateGenerationReference(gen.id, pickRef.id);
        } else if (process.env.GEMINI_API_KEY) {
          const img = await generateImage(art.output.imagePrompt, fmt.aspect);
          if (img) {
            const saved = await saveBytes(args.brand.slug, img.bytes, img.mime);
            const ref = createReference({
              brandId: args.brand.id,
              kind: "generated",
              source: "gemini",
              label: `Generated · ${idea.theme.slice(0, 40)} · ${fmt.aspect}`,
              prompt: art.output.imagePrompt,
              filePath: saved.publicPath,
              mime: img.mime,
              width: img.width,
              height: img.height,
              tags: [fmt.aspect, "gemini", `seed:${art.output.seed}`],
            });
            updateGenerationReference(gen.id, ref.id);
          }
        }

        count++;
      }
    }
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
}): Promise<{ chainId: string; runId: string; ideaCount: number }> {
  const chainId = newChainId();
  const run = await recordRun({
    kind: "strategist",
    chainId,
    brandId: args.brand.id,
    campaignId: args.campaignId,
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
