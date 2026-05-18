import { db } from "@/lib/db";
import { getBrand, getCampaign } from "@/lib/repo";
import { runCritic } from "@/lib/agents/critic";
import { recordRun, newChainId, usageBreakdown, usageTotals } from "@/lib/agents/persistence";
import { claudeStatus, claudeModel, getClaude } from "@/lib/agents/adapters/claude";
import { formatUsd } from "@/lib/agents/pricing";

async function main() {
  db();
  console.log("Claude status:", claudeStatus());

  const brandRow: any = db().prepare("SELECT id FROM brands LIMIT 1").get();
  if (!brandRow) throw new Error("Seed first");
  const brand = getBrand(brandRow.id)!;
  console.log("Brand:", brand.name);

  const chainId = newChainId();
  // Run critic once — quickly exercises the Claude code path. Falls back to mock on rate-limit.
  const result = await recordRun({
    kind: "critic",
    chainId,
    brandId: brand.id,
    provider: getClaude() ? { name: "claude", model: claudeModel() } : { name: "mock", model: "augen-mock@1" },
    input: { test: true },
    fn: () => runCritic({
      brand, language: brand.language,
      formatSlug: "meta-feed-4x5",
      copy: {
        eyebrow: "FIELD-TESTED",
        headline: "Begin with\nTanda.",
        subhead: "Wild-fermented, low sugar, made by feel.",
        cta: "Try the starter set",
      },
    }),
  });
  console.log("Critic verdict:", (result.output as any).verdict, "score:", (result.output as any).score);

  const totals = usageTotals();
  console.log("Totals (all time):", totals);
  for (const r of usageBreakdown()) {
    console.log(`  ${r.kind} via ${r.provider}: ${r.runs} runs, ${r.tokens_in}+${r.tokens_out} tok, ${formatUsd(r.cost_micros)}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
