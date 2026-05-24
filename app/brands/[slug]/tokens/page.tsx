import { Card, Eyebrow, Section, Badge } from "@/components/ui/primitives";
import { getBrandBySlug } from "@/lib/repo";
import { notFound } from "next/navigation";
import { TokensEditor } from "./editor";
import { TokenSubNav } from "@/components/token-subnav";

export const dynamic = "force-dynamic";

export default async function TokensPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-10">
      <TokenSubNav slug={brand.slug} active="editor" />
      <div className="flex items-start justify-between gap-6">
        <div>
          <Eyebrow>{brand.name} · token system v{brand.tokens.semver}</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">Design tokens</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            Every campaign reads from this. Edit a value and every generated ad rebuilds against the new system.
            JSON below is the source of truth.
          </p>
        </div>
        <Badge tone="info">{brand.tokens.imagery.style} imagery</Badge>
      </div>

      <TokensEditor brand={brand} />

      <Section title="Where tokens go" subtitle="A short tour of how each token surfaces in the engine.">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            ["Palette", "Background, surface, foreground. Plus three brand accents that drive scrim, rules, CTA marks, and the composer's atmosphere."],
            ["Typography", "Display family runs the headline. Body runs eyebrow, subhead, CTA, locker. Tracking and line-height resolve per-format."],
            ["Scrim", "A directional fade that lifts copy off the photo. Coverage and opacity scale with the imagery style — moody is heavier, minimalist disappears."],
            ["Voice", "Headlines pass a check for do-not tokens. Confidence drops when violated."],
            ["Imagery", "Treatment string is appended to every generated image prompt. Style governs background composition."],
            ["Locker", "Brand wordmark and a quiet location line. Appears in every format unless explicitly disabled."],
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
