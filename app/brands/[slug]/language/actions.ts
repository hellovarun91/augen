"use server";
import { BrandLanguage } from "@/lib/types";
import {
  getBrand, updateBrandLanguage,
  createRuleProposal, listRuleProposals, updateRuleProposalStatus, getRuleProposal,
} from "@/lib/repo";
import { revalidatePath } from "next/cache";
import { runCritic } from "@/lib/agents/critic";
import { refineRulesFromReviews } from "@/lib/agents/rule-refiner";
import { recordRun, newChainId } from "@/lib/agents/persistence";
import { claudeModel, getClaude } from "@/lib/agents/adapters/claude";

export async function saveLanguage(brandId: string, language: BrandLanguage) {
  const parsed = BrandLanguage.parse(language);
  updateBrandLanguage(brandId, parsed);
  revalidatePath("/brands/[slug]/language", "page");
  revalidatePath("/brands/[slug]", "page");
}

export async function runRuleRefinerAction(brandId: string, brandSlug: string) {
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  const chainId = newChainId();
  const result = await recordRun({
    kind: "critic", // closest existing kind; refiner reads notes and proposes
    chainId,
    brandId,
    provider: getClaude() ? { name: "claude", model: claudeModel() } : { name: "mock", model: "augen-mock@1" },
    input: { task: "rule_refiner" },
    fn: async () => {
      const r = await refineRulesFromReviews(brand);
      return { output: { proposals: r.proposals }, rationale: r.rationale, usage: r.usage };
    },
  });
  let count = 0;
  for (const p of (result.output as any).proposals) {
    createRuleProposal({ brandId, kind: p.kind, rule: p.rule, evidence: p.evidence });
    count++;
  }
  revalidatePath(`/brands/${brandSlug}/language`);
  return { proposals: count, provider: getClaude() ? "claude" : "heuristic" };
}

export async function acceptProposalAction(proposalId: string, brandSlug: string) {
  const p = getRuleProposal(proposalId);
  if (!p) throw new Error("Proposal not found");
  const brand = getBrand(p.brand_id);
  if (!brand) throw new Error("Brand missing");
  const lang = brand.language;
  if (p.kind === "do") lang.doRules = uniq([...lang.doRules, p.rule]);
  else if (p.kind === "dont") lang.doNotRules = uniq([...lang.doNotRules, p.rule]);
  else if (p.kind === "preferred") lang.preferredWords = uniq([...lang.preferredWords, p.rule]);
  else if (p.kind === "banned") lang.bannedWords = uniq([...lang.bannedWords, p.rule]);
  updateBrandLanguage(brand.id, lang);
  updateRuleProposalStatus(proposalId, "accepted");
  revalidatePath(`/brands/${brandSlug}/language`);
}

export async function dismissProposalAction(proposalId: string, brandSlug: string) {
  updateRuleProposalStatus(proposalId, "dismissed");
  revalidatePath(`/brands/${brandSlug}/language`);
}

function uniq<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

export async function criticPreview(
  brandId: string,
  language: BrandLanguage,
  copy: { headline: string; subhead: string; cta: string; eyebrow?: string },
  formatSlug: string,
) {
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Brand missing");
  const parsedLang = BrandLanguage.parse(language);
  const { output } = await runCritic({
    brand,
    language: parsedLang,
    formatSlug,
    copy: { eyebrow: copy.eyebrow || "", headline: copy.headline, subhead: copy.subhead, cta: copy.cta },
  });
  return {
    score: output.score,
    voiceFit: output.voiceFit,
    formatFit: output.formatFit,
    conceptStrength: output.conceptStrength,
    verdict: output.verdict,
    notes: output.notes,
  };
}
