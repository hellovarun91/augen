import { db } from "@/lib/db";
import { getBrand, getIdea } from "@/lib/repo";
import { createVariationBatch, expandCombinations, listBatchGenerations, parseCsvVariations } from "@/lib/variations";

db();

// Cross-product expansion math
const slots = {
  headline: ["A.", "B.", "C."],
  subhead: ["x", "y"],
  cta: ["Go", "Stop", "Wait", "Move"],
  eyebrow: ["NEW"],
  imageRefIds: [null, null],
};
const cross = expandCombinations(slots, "cross");
console.log("cross:", cross.length, "(expected", 3 * 2 * 4 * 1 * 2, ")");

const zip = expandCombinations(slots, "zip");
console.log("zip:", zip.length, "(expected max =", Math.max(3, 2, 4, 1, 2), ")");

// CSV parse
const csv = `headline,subhead,cta,eyebrow,image_ref_id
"Begin with Tanda.","Wild fermented.","Find a store","FIELD-TESTED",
"Made for the second cup.","Made by feel.","Order today","JUST IN",
"Quietly correct.","Designed to be the default.","Subscribe","STUDIO",`;
const combos = parseCsvVariations(csv);
console.log("csv combos:", combos.length, "first:", combos[0]);

// Real generation against the seeded brand
const brandRow: any = db().prepare("SELECT id FROM brands LIMIT 1").get();
const ideaRow: any = db().prepare("SELECT id, campaign_id FROM ideas WHERE campaign_id IN (SELECT id FROM campaigns WHERE brand_id = ?) LIMIT 1").get(brandRow.id);
if (!brandRow || !ideaRow) {
  console.log("Need seeded brand + idea — run npm run seed first.");
  process.exit(1);
}
const brand = getBrand(brandRow.id)!;
const idea = getIdea(ideaRow.id)!;

const r = createVariationBatch({
  brand,
  idea,
  campaignId: ideaRow.campaign_id,
  name: "Variation smoke test",
  strategy: "cross",
  slots: {
    headline: ["Begin with Tanda.", "Quietly correct.", "Made for the second cup."],
    subhead: ["Wild fermented.", "Made by feel."],
    cta: ["Find a store", "Order today", "Subscribe & save", "Read the story"],
    eyebrow: ["FIELD-TESTED"],
    imageRefIds: [null],
  },
  formats: ["meta-feed-1x1", "meta-feed-4x5"],
});

console.log("batch:", r);
const gens = listBatchGenerations(r.batchId);
console.log("first gen headline:", gens[0]?.headline);
console.log("first gen cta:", gens[0]?.cta);
console.log("first gen format:", gens[0]?.format_slug);
