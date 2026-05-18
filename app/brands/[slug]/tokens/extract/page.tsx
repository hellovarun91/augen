import { Card, Eyebrow, Section, Badge } from "@/components/ui/primitives";
import { getBrandBySlug } from "@/lib/repo";
import { notFound } from "next/navigation";
import { ExtractForm } from "./form";
import { claudeStatus } from "@/lib/agents/adapters/claude";

export const dynamic = "force-dynamic";

export default async function ExtractPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const claude = claudeStatus();

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div>
          <Eyebrow>{brand.name} · token extraction</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">Read a design. Get a system.</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            Upload a finished ad. Claude vision returns a complete <code className="text-ink-200">BrandTokens</code> JSON — palette, type,
            scrim, voice, imagery. Preview it, then merge to overwrite this brand's tokens.
          </p>
        </div>
        <Badge tone={claude.enabled ? "ok" : "warn"}>{claude.enabled ? `Claude · ${claude.model}` : "Set ANTHROPIC_API_KEY to extract"}</Badge>
      </div>

      <Card className="p-6">
        <ExtractForm brandId={brand.id} brandSlug={brand.slug} brandName={brand.name} industry={brand.industry || ""} disabled={!claude.enabled} />
      </Card>

      <Section title="How it maps">
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          {[
            ["Palette", "Seven semantic colors read from the image — including a foreground and a muted neutral, not just dominant hues."],
            ["Typography", "CSS font stacks inferred from the display/body pairing. Tracking and a scale come along for the ride."],
            ["Voice + imagery", "Tone tags from copy register. Style keyword and a one-sentence treatment from the photographic quality."],
          ].map(([t, b]) => (
            <Card key={t as string} className="p-5">
              <div className="serif text-xl">{t}</div>
              <div className="text-ink-300 mt-2">{b}</div>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
