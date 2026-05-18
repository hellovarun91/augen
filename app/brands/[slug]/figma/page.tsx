import { Badge, Card, Eyebrow, Section } from "@/components/ui/primitives";
import { getBrandBySlug, getBrandFigmaUrl } from "@/lib/repo";
import { notFound } from "next/navigation";
import { FigmaSyncForm } from "./form";
import { figmaStatus } from "@/lib/images/providers";

export const dynamic = "force-dynamic";

export default async function FigmaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const fileUrl = getBrandFigmaUrl(brand.id) || "";
  const status = figmaStatus();

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div>
          <Eyebrow>{brand.name} · Figma sync</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">Round-trip between Figma and the engine.</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            Designers stay in Figma. Augen reads Variables on pull. Token edits in the studio can be pushed back as Variables.
            Use the naming conventions in <code className="text-ink-200">color/*</code>, <code className="text-ink-200">font/*</code>, etc.
          </p>
        </div>
        <Badge tone={status.enabled ? "ok" : "warn"}>{status.enabled ? "FIGMA_PERSONAL_ACCESS_TOKEN ready" : "Set FIGMA_PERSONAL_ACCESS_TOKEN"}</Badge>
      </div>

      <Card className="p-6">
        <FigmaSyncForm
          brandId={brand.id}
          brandSlug={brand.slug}
          fileUrl={fileUrl}
          currentTokens={brand.tokens}
          disabled={!status.enabled}
        />
      </Card>

      <Section title="Naming convention">
        <Card className="p-6">
          <pre className="text-[11px] text-ink-300 leading-relaxed">{`color/background          → tokens.palette.background       (COLOR)
color/surface             → tokens.palette.surface           (COLOR)
color/foreground          → tokens.palette.foreground        (COLOR)
color/primary             → tokens.palette.primary           (COLOR)
color/secondary           → tokens.palette.secondary         (COLOR)
color/accent              → tokens.palette.accent            (COLOR)
color/muted               → tokens.palette.muted             (COLOR)

font/display              → tokens.fonts.display             (STRING — CSS stack)
font/body                 → tokens.fonts.body                (STRING — CSS stack)

type/headlineSize         → tokens.type.headlineSize         (FLOAT)
type/subheadSize          → tokens.type.subheadSize          (FLOAT)
type/eyebrowSize          → tokens.type.eyebrowSize          (FLOAT)
type/ctaSize              → tokens.type.ctaSize              (FLOAT)
type/lockerSize           → tokens.type.lockerSize           (FLOAT)
type/tracking             → tokens.type.tracking             (FLOAT)

scrim/topOpacity          → tokens.scrim.topOpacity          (FLOAT)
scrim/midOpacity          → tokens.scrim.midOpacity          (FLOAT)
scrim/bottomOpacity       → tokens.scrim.bottomOpacity       (FLOAT)
scrim/coverage            → tokens.scrim.coverage            (FLOAT)
scrim/tint                → tokens.scrim.tint                (STRING — hex)

locker/wordmark           → tokens.locker.wordmark           (STRING)
locker/locationLine       → tokens.locker.locationLine       (STRING)

imagery/style             → tokens.imagery.style             (STRING)
imagery/treatment         → tokens.imagery.treatment         (STRING)`}</pre>
        </Card>
      </Section>
    </div>
  );
}
