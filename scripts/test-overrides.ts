import { db } from "@/lib/db";
import { getBrand, getGeneration, updateGenerationOverrides } from "@/lib/repo";
import { renderAdSvg } from "@/lib/composer/render";
import { parseOverrides } from "@/lib/composer/overrides";

db();
const row: any = db().prepare("SELECT id FROM generations LIMIT 1").get();
const gen = getGeneration(row.id)!;
const brand = getBrand(gen.brand_id)!;

function render(overrides?: any) {
  const ov = parseOverrides(overrides);
  return renderAdSvg({
    width: gen.width, height: gen.height, aspect: gen.aspect, tokens: brand.tokens,
    copy: { eyebrow: gen.eyebrow || undefined, headline: gen.headline, subhead: gen.subhead || "", cta: gen.cta },
    seed: gen.image_seed, style: gen.image_style || brand.tokens.imagery.style,
    overrides: ov,
  });
}

const baseline = render();
console.log("baseline SVG bytes:", baseline.length);

const withEmphasis = render({
  typography: {
    headlineScale: 1.25,
    emphasis: [{ word: gen.headline.split(/\s+/)[0].replace(/[^A-Za-z]/g, ""), style: "accent" }],
  },
  layout: { ctaPosition: "top-right" },
  colors: { rule: "#FF0066" },
});
console.log("override SVG bytes:", withEmphasis.length);
console.log("contains accent tspan:", /tspan fill=/.test(withEmphasis));
console.log("contains rule color override:", withEmphasis.includes("#FF0066"));
console.log("CTA at top-right (text-anchor end + y near top):", /text-anchor="end".*?y="\d{1,3}"/.test(withEmphasis));
