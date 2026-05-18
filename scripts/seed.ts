// Seeds users, demo brands, drafts plans, and runs one campaign to populate the gallery.
import { synthesizeBrand } from "@/lib/ai/brand-builder";
import { createBrand, createCampaign, createIdea, getBrandBySlug, listBrands } from "@/lib/repo";
import { planQuarter, plannedToBrief } from "@/lib/ai/planner";
import { generateAdsViaAgents } from "@/lib/agents/orchestrator";
import { slugify } from "@/lib/utils";
import { db } from "@/lib/db";
import { addMembership, createUser, getUserByEmail, pickAvatarColor } from "@/lib/users";

const DEMOS = [
  {
    name: "Tanda Kombucha",
    brief: "Tanda is a small-batch kombucha brand making bright, low-sugar drinks with wild-fermented yeast and raw fruit. Quietly confident voice — calm, premium, considered. Sold in specialty grocers and cafes.",
  },
  {
    name: "Lumen Skincare",
    brief: "Lumen is a clean-beauty skincare line for sensitive skin. Clinically dosed actives, third-party tested. Editorial, premium, restrained — never shouty.",
  },
  {
    name: "Forge & Field",
    brief: "Forge & Field is a craft roaster — single-origin, slow-roasted. Maker-forward, warm, artisan. The kind of shop that names its grinder.",
  },
];

function ensureBrand(name: string, brief: string) {
  const slug = slugify(name);
  const existing = getBrandBySlug(slug);
  if (existing) return existing;
  const synth = synthesizeBrand(brief, { name, slug });
  return createBrand({
    name: synth.name,
    slug: synth.slug,
    tagline: synth.tagline,
    industry: synth.industry,
    description: synth.description,
    tokens: synth.tokens,
  });
}

const DEMO_USERS = [
  { email: "varun@augen.studio", name: "Varun Saini" },
  { email: "studio@augen.studio", name: "Studio" },
];

async function main() {
  // Touch DB to ensure tables exist
  db();

  // Seed users
  const users = DEMO_USERS.map((u) => getUserByEmail(u.email) || createUser(u.email, u.name, pickAvatarColor(u.email)));
  const primary = users[0];
  console.log("Users:", users.map((u) => `${u.name} <${u.email}>`).join(", "));

  for (const d of DEMOS) {
    const brand = ensureBrand(d.name, d.brief);
    console.log("Brand ready:", brand.name);
    // Make the primary user a member of every demo brand; the second user is a member of two.
    for (const u of users) addMembership(u.id, brand.id, u.id === primary.id ? "owner" : "editor");

    const now = new Date();
    const q = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
    const planned = planQuarter(brand, now.getFullYear(), `Q${q}` as "Q1" | "Q2" | "Q3" | "Q4");

    // Only seed plans once
    const existingCampaignCount = db().prepare("SELECT COUNT(*) as c FROM campaigns WHERE brand_id = ?").get(brand.id) as { c: number };
    if (existingCampaignCount.c === 0) {
      for (const p of planned) {
        const campaign = createCampaign({
          brandId: brand.id,
          name: p.name,
          quarter: p.quarter,
          year: p.year,
          objective: p.objective,
          audience: p.audience,
          brief: plannedToBrief(p),
        });
        let i = 0;
        for (const idea of p.ideas) {
          createIdea({
            campaignId: campaign.id,
            theme: idea.theme,
            insight: idea.insight,
            angle: idea.angle,
            audience: idea.audience,
            promise: idea.promise,
            hooks: idea.hooks,
            visualDirection: idea.visualDirection,
            orderIdx: i++,
          });
        }
        // Only run the first campaign per brand to keep the seed quick
        if (p === planned[0]) {
          const res = await generateAdsViaAgents({ campaignId: campaign.id, brand, brief: plannedToBrief(p), variantsPerFormat: 1 });
          console.log(`  - ran ${campaign.name}: ${res.generations} ads via agents (chain ${res.chainId})`);
        }
      }
    } else {
      console.log("  - already has campaigns, skipping plan");
    }
  }
  console.log("\nSeed complete. Run: npm run dev → http://localhost:3000");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
