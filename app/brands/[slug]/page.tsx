import { Badge, Card, Empty, Eyebrow, LinkButton, Section, Stat } from "@/components/ui/primitives";
import { getBilling, getBrandBySlug, listCampaignsByBrand } from "@/lib/repo";
import { formatBySlug } from "@/lib/formats";
import { AdPreviewPreview } from "@/components/ad-preview";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents, relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const campaigns = listCampaignsByBrand(brand.id);
  const billing = getBilling(brand.id);

  const previewFormats = ["meta-feed-1x1", "meta-feed-4x5", "meta-story-9x16", "google-display-300x600"];

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto space-y-12">
      <header
        className="rounded-2xl p-8 ring-1 ring-white/10"
        style={{ background: `linear-gradient(135deg, ${brand.tokens.palette.primary}, ${brand.tokens.palette.accent})` }}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <Eyebrow className="!text-white/80">{brand.industry || "brand"} · v{brand.tokens.semver}</Eyebrow>
            <h1 className="serif text-display-xl mt-1 tracking-tight" style={{ color: brand.tokens.palette.background }}>
              {brand.name}
            </h1>
            <p className="mt-3 text-lg max-w-2xl" style={{ color: brand.tokens.palette.background, opacity: 0.95 }}>
              {brand.tagline}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex gap-2">
              <LinkButton href={`/brands/${brand.slug}/tokens`} variant="secondary" size="sm">Tokens</LinkButton>
              <LinkButton href={`/brands/${brand.slug}/plan`} variant="secondary" size="sm">Plan quarter</LinkButton>
            </div>
            <div className="flex items-center gap-2">
              {Object.entries(brand.tokens.palette).slice(0, 6).map(([k, v]) => (
                <span key={k} title={`${k}: ${v}`} className="w-5 h-5 rounded-full ring-1 ring-black/10" style={{ background: v as string }} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-5"><Stat label="Campaigns" value={campaigns.length} /></Card>
        <Card className="p-5"><Stat label="Voice" value={<span className="serif text-2xl">{brand.tokens.voice.tone.slice(0, 2).join(", ")}</span>} /></Card>
        <Card className="p-5"><Stat label="Imagery" value={<span className="serif text-2xl capitalize">{brand.tokens.imagery.style}</span>} /></Card>
        <Card className="p-5"><Stat label="Balance" value={formatCents(billing?.balance_cents || 0)} sub="mock credits" /></Card>
      </div>

      <Section title="Sample creative" subtitle="Drafted with placeholder copy — to test the token system across the format catalog.">
        <div className="grid md:grid-cols-4 gap-4">
          {previewFormats.map((fs) => {
            const f = formatBySlug(fs)!;
            return (
              <div key={fs} className="space-y-2">
                <AdPreviewPreview
                  brandId={brand.id}
                  formatSlug={fs}
                  copy={{
                    eyebrow: "FIELD-TESTED",
                    headline: brand.tagline?.replace(/\.\s*/g, ".\n") || "An honest\nupgrade.",
                    subhead: "A token system survives the format. So does the voice.",
                    cta: "See campaigns",
                  }}
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-200">{f.name}</span>
                  <span className="text-ink-400">{f.width}×{f.height}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Quarterly campaigns"
        subtitle="Drafted by the planner. Edit, regenerate, or run any one of them."
        action={<LinkButton href={`/brands/${brand.slug}/plan`} variant="ghost" size="sm">Plan another quarter →</LinkButton>}
      >
        {campaigns.length === 0 ? (
          <Empty title="No campaigns drafted yet">
            Run the planner to seed three campaigns for the next quarter.
            <div className="mt-4"><LinkButton href={`/brands/${brand.slug}/plan`}>Plan a quarter →</LinkButton></div>
          </Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {campaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`}>
                <Card className="p-5 transition-colors hover:bg-ink-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="serif text-xl tracking-tight">{c.name}</div>
                      <div className="text-xs text-ink-400 mt-1">{relativeDate(c.created_at)} · {c.quarter} {c.year}</div>
                    </div>
                    <Badge tone={c.status === "approved" ? "ok" : c.status === "ready_for_review" ? "info" : "neutral"}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                    <div><Eyebrow>Audience</Eyebrow><div className="text-ink-200 mt-1 line-clamp-1">{c.audience || "—"}</div></div>
                    <div><Eyebrow>Objective</Eyebrow><div className="text-ink-200 mt-1">{c.objective || "—"}</div></div>
                    <div><Eyebrow>Formats</Eyebrow><div className="text-ink-200 mt-1">{c.brief.formats.length}</div></div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Voice notes">
        <Card className="p-6 grid md:grid-cols-3 gap-6">
          <div>
            <Eyebrow>Description</Eyebrow>
            <p className="text-ink-100 mt-2 text-sm leading-relaxed">{brand.tokens.voice.description}</p>
          </div>
          <div>
            <Eyebrow>Tone</Eyebrow>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {brand.tokens.voice.tone.map((t) => <Badge key={t}>{t}</Badge>)}
            </div>
          </div>
          <div>
            <Eyebrow>Do not</Eyebrow>
            <ul className="text-sm text-ink-200 mt-2 space-y-1">
              {brand.tokens.voice.doNot.map((d) => <li key={d}>— {d}</li>)}
            </ul>
          </div>
        </Card>
      </Section>
    </div>
  );
}
