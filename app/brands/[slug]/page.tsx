import { Badge, Card, Empty, Eyebrow, LinkButton, Section, Stat } from "@/components/ui/primitives";
import { getBrandBySlug, listCampaignsByBrand, listGenerationsByCampaign } from "@/lib/repo";
import { formatBySlug } from "@/lib/formats";
import { AdPreview, AdPreviewPreview } from "@/components/ad-preview";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import Link from "next/link";
import { notFound } from "next/navigation";
import { relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();
  const projects = listCampaignsByBrand(brand.id);
  const gens = projects.flatMap((c) => listGenerationsByCampaign(c.id));
  const pending = gens.filter((g) => g.status === "pending_review");
  const approved = gens.filter((g) => g.status === "approved");

  const previewFormats = ["meta-feed-1x1", "meta-feed-4x5", "meta-story-9x16", "google-display-300x600"];

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-12">
      <SyncActiveBrand brandId={brand.id} />
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
              <LinkButton href={`/brands/${brand.slug}/identity`} variant="secondary" size="sm">Edit identity</LinkButton>
              <LinkButton href={`/brands/${brand.slug}/plan`} variant="secondary" size="sm">AI Planner</LinkButton>
              <LinkButton href="/campaigns" variant="secondary" size="sm">Open Studio</LinkButton>
            </div>
            <div className="flex items-center gap-2">
              {Object.entries(brand.tokens.palette).slice(0, 6).map(([k, v]) => (
                <span key={k} title={`${k}: ${v}`} className="w-5 h-5 rounded-full ring-1 ring-black/10" style={{ background: v as string }} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-5"><Stat label="Projects" value={projects.length} /></Card>
        <Card className="p-5"><Stat label="Creatives" value={gens.length} /></Card>
        <Card className="p-5"><Stat label="Pending review" value={pending.length} /></Card>
        <Card className="p-5"><Stat label="Approved" value={approved.length} /></Card>
      </div>

      {pending.length > 0 && (
        <Section
          title="Pending review"
          subtitle="Creatives waiting on your call. Triaged low-to-high confidence."
          action={<LinkButton href="/review" variant="ghost" size="sm">Open review →</LinkButton>}
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pending.slice(0, 8).map((g) => (
              <Link key={g.id} href={`/ads/${g.id}`} className="group block space-y-2">
                <AdPreview generationId={g.id} width={g.width} height={g.height} />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-300">{g.format_slug}</span>
                  <Badge tone={g.confidence > 0.85 ? "ok" : g.confidence > 0.7 ? "warn" : "danger"}>
                    {(g.confidence * 100).toFixed(0)}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Studio projects"
        subtitle="A project holds a brief, its ideas, and the creatives they produce."
        action={<LinkButton href="/campaigns" variant="ghost" size="sm">All projects →</LinkButton>}
      >
        {projects.length === 0 ? (
          <Empty title="No projects yet">
            Open the Studio to create one, or let the Planner draft a few to start from.
            <div className="mt-4 flex gap-2 justify-center">
              <LinkButton href="/campaigns">Open Studio →</LinkButton>
              <LinkButton href={`/brands/${brand.slug}/plan`} variant="ghost">AI Planner</LinkButton>
            </div>
          </Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {projects.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`}>
                <Card className="p-5 transition-colors hover:bg-ink-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="serif text-xl tracking-tight">{c.name}</div>
                      <div className="text-xs text-ink-400 mt-1">{relativeDate(c.created_at)} · {c.quarter} {c.year}</div>
                    </div>
                    <Badge tone={c.status === "approved" ? "ok" : c.status === "ready_for_review" ? "info" : "neutral"}>
                      {c.status.replace(/_/g, " ")}
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

      <Section
        title="Sample creative"
        subtitle="Drafted with placeholder copy — to test the token system across the format catalog."
        action={<LinkButton href={`/brands/${brand.slug}/tokens`} variant="ghost" size="sm">Edit design tokens →</LinkButton>}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
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
                    cta: "See projects",
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
        title="Voice notes"
        subtitle="What the copywriter listens to. Sharpen the rules and the copy sharpens with it."
        action={<LinkButton href={`/brands/${brand.slug}/language`} variant="ghost" size="sm">Edit voice & rules →</LinkButton>}
      >
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
