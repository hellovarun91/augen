import { Card, Eyebrow, Section } from "@/components/ui/primitives";
import { NewBrandForm } from "./form";

export const dynamic = "force-dynamic";

const PRESETS = [
  {
    label: "Tanda Kombucha",
    body: "Tanda is a small-batch kombucha brand making bright, low-sugar drinks with wild-fermented yeast and raw fruit. Quietly confident voice — calm, premium, considered. Sold in specialty grocers and cafes.",
  },
  {
    label: "Lumen Skincare",
    body: "Lumen is a clean-beauty skincare line for sensitive skin. Clinically dosed actives, third-party tested. Editorial, premium, restrained — never shouty.",
  },
  {
    label: "Atlas Banking",
    body: "Atlas is a fintech for self-employed founders. Money where you can see it. Direct, useful, no theater. Plain language. Trust comes from precision.",
  },
  {
    label: "Forge & Field Coffee",
    body: "Forge & Field is a craft roaster — single-origin, slow-roasted. Maker-forward, warm, artisan. The kind of shop that names its grinder.",
  },
];

export default function NewBrandPage() {
  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-5xl mx-auto space-y-10">
      <div>
        <Eyebrow>Onboard a brand</Eyebrow>
        <h1 className="serif text-display-lg mt-2 tracking-tight">A brief. We do the rest.</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Drop a paragraph that describes the brand — voice, audience, what they sell, what they don't. Augen synthesizes the
          token system, voice rules, and imagery treatment from that. Editable end-to-end.
        </p>
      </div>

      <Card className="p-6 md:p-8">
        <NewBrandForm presets={PRESETS} />
      </Card>

      <Section title="What you get on submit">
        <ol className="grid md:grid-cols-2 gap-4">
          {[
            ["1.", "A full token system — palette, typography, scrim, voice, imagery treatment."],
            ["2.", "A drafted quarterly plan with 3 projects and 12 idea seeds."],
            ["3.", "Format coverage across Meta, Google, LinkedIn, Pinterest, TikTok, X, Snap, Reddit."],
          ].map(([n, t]) => (
            <li key={n as string} className="rounded-xl ring-1 ring-white/5 p-4 bg-ink-900/60">
              <div className="serif text-2xl text-ink-100">{n}</div>
              <div className="text-sm text-ink-300 mt-2">{t}</div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
