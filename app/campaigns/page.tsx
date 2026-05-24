import { Badge, Card, Empty, Eyebrow, LinkButton, Section } from "@/components/ui/primitives";
import { listCampaignsByBrand } from "@/lib/repo";
import { getSession } from "@/lib/session";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";
import { ProjectsHeaderActions, ProjectCardActions } from "./controls";

export const dynamic = "force-dynamic";

// Studio · Projects — the brand-scoped home for creative projects.
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
        subtitle="A project is a brief, a set of ideas, and the creatives they produce. Start one yourself or let AI draft a few."
        action={<ProjectsHeaderActions brandId={activeBrand.id} slug={activeBrand.slug} />}
      >
        {projects.length === 0 ? (
          <Empty title="No projects yet">
            Create one directly, or let the Planner draft a few you can shape.
          </Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {projects.map((c) => (
              <Card key={c.id} className="p-5 space-y-4">
                <Link href={`/campaigns/${c.id}`} className="block group">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="serif text-xl tracking-tight group-hover:underline">{c.name}</div>
                      <div className="text-xs text-ink-400 mt-1">{relativeDate(c.created_at)}{c.quarter ? ` · ${c.quarter} ${c.year}` : ""}</div>
                    </div>
                    <Badge tone={c.status === "approved" ? "ok" : c.status === "ready_for_review" ? "info" : "neutral"}>
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                    <div><Eyebrow>Audience</Eyebrow><div className="text-ink-200 mt-1 line-clamp-1">{c.audience || "—"}</div></div>
                    <div><Eyebrow>Intent</Eyebrow><div className="text-ink-200 mt-1 line-clamp-1">{c.objective || "—"}</div></div>
                    <div><Eyebrow>Formats</Eyebrow><div className="text-ink-200 mt-1">{c.brief.formats.length}</div></div>
                  </div>
                </Link>
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <Link href={`/campaigns/${c.id}`} className="text-xs text-ink-300 hover:text-white">Open →</Link>
                  <ProjectCardActions campaignId={c.id} name={c.name} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
