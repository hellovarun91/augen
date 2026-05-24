import { Badge, Card, Empty, Eyebrow, LinkButton, Section } from "@/components/ui/primitives";
import { listCampaignsByBrand } from "@/lib/repo";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Studio · Projects — the brand-scoped list of creative projects.
export default async function ProjectsPage() {
  const { activeBrand } = await getSession();
  if (!activeBrand) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto">
        <Empty title="No brand selected">Pick a brand from the board to open its Studio.</Empty>
        <div className="mt-4"><LinkButton href="/">← All brands</LinkButton></div>
      </div>
    );
  }
  const projects = listCampaignsByBrand(activeBrand.id);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-10">
      <Section
        title={`${activeBrand.name} · Projects`}
        subtitle="A project is a brief, a set of ideas, and the creatives they produce."
        action={<LinkButton href={`/brands/${activeBrand.slug}/plan`}>Plan a quarter →</LinkButton>}
      >
        {projects.length === 0 ? (
          <Empty title="No projects yet">
            Plan a quarter to seed three projects to start from.
            <div className="mt-4"><LinkButton href={`/brands/${activeBrand.slug}/plan`}>Plan a quarter →</LinkButton></div>
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
    </div>
  );
}
