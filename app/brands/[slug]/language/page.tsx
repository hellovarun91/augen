import { Card, Eyebrow, Section, Badge } from "@/components/ui/primitives";
import { getBrandBySlug } from "@/lib/repo";
import { notFound } from "next/navigation";
import { LanguageEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function LanguagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto space-y-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <Eyebrow>{brand.name} · brand language</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">How {brand.name} talks.</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            This is the source the Strategist and Copywriter read every time they draft. Tune the description, slide the tone, edit the lexicon —
            every following generation is conditioned on this surface.
          </p>
        </div>
        <Badge tone="info">Read by Strategist · Copywriter · QC Critic</Badge>
      </div>

      <LanguageEditor brand={brand} />

      <Section title="How the agents read this">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            ["Strategist", "Reads voiceDescription + tone sliders to decide register. Skips ideas whose visualDirection clashes with the brand's mood."],
            ["Copywriter", "Filters out banned words. Promotes lines that use preferred words. Honors operator constraints ('shorter', 'lead with benefit')."],
            ["QC Critic", "Scores voice fit against banned/preferred. Flags ALL-CAPS runs and exclamation marks when the tone profile leans serious."],
          ].map(([t, b]) => (
            <Card key={t as string} className="p-5">
              <div className="serif text-xl">{t}</div>
              <div className="text-sm text-ink-300 mt-2">{b}</div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
