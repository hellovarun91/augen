import { Card, Eyebrow, Section, Badge, LinkButton } from "@/components/ui/primitives";
import { getBrandBySlug } from "@/lib/repo";
import { planQuarter } from "@/lib/ai/planner";
import { notFound } from "next/navigation";
import { PlannerControls, AcceptPlanForm } from "./controls";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const brand = getBrandBySlug(slug);
  if (!brand) notFound();

  const now = new Date();
  const defaultQ = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const defaultNext = (defaultQ === 4 ? 1 : defaultQ + 1) as 1 | 2 | 3 | 4;
  const year = parseInt(sp.year || `${now.getFullYear()}`, 10);
  const quarter = (sp.q as "Q1" | "Q2" | "Q3" | "Q4") || (`Q${defaultNext}` as "Q1" | "Q2" | "Q3" | "Q4");

  const planned = planQuarter(brand, year, quarter);

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto space-y-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <Eyebrow>{brand.name}</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">Quarterly plan · {quarter} {year}</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            Three campaigns. One per objective. Each comes with audience, channels, KPIs, and four idea seeds you can edit or replace.
          </p>
        </div>
        <PlannerControls slug={brand.slug} currentQ={quarter} currentYear={year} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {planned.map((p, i) => (
          <Card key={i} className="p-6 space-y-5">
            <div>
              <Badge tone="info">{p.objective}</Badge>
              <div className="serif text-2xl mt-3 tracking-tight">{p.name}</div>
              <div className="text-xs text-ink-400 mt-1">{p.audience}</div>
            </div>

            <div>
              <Eyebrow>Rationale</Eyebrow>
              <p className="text-sm text-ink-200 mt-2 leading-relaxed">{p.rationale}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <Eyebrow>Channels</Eyebrow>
                <div className="mt-1 text-ink-200">{p.channels.join(", ")}</div>
              </div>
              <div>
                <Eyebrow>Budget</Eyebrow>
                <div className="mt-1 text-ink-200">${p.budget.toLocaleString()}</div>
              </div>
              <div>
                <Eyebrow>Product focus</Eyebrow>
                <div className="mt-1 text-ink-200">{p.productFocus.join(" · ")}</div>
              </div>
              <div>
                <Eyebrow>KPIs</Eyebrow>
                <div className="mt-1 text-ink-200">{p.kpis.join(" · ")}</div>
              </div>
            </div>

            <div>
              <Eyebrow>Idea seeds</Eyebrow>
              <ul className="space-y-3 mt-2">
                {p.ideas.map((idea, j) => (
                  <li key={j} className="rounded-lg ring-1 ring-white/5 bg-ink-900/60 p-3">
                    <div className="serif text-base">{idea.theme}</div>
                    <div className="text-xs text-ink-400 mt-1">{idea.angle} · {idea.audience}</div>
                    <div className="text-xs text-ink-200 mt-2 line-clamp-2">{idea.insight}</div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Section title="Accept the plan?" subtitle="Adds these as live campaigns under this brand. You can run any one of them right after.">
        <AcceptPlanForm brandId={brand.id} year={year} quarter={quarter} />
      </Section>

      <Section title="What the planner considers">
        <Card className="p-6 grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <Eyebrow>Seasonal mood</Eyebrow>
            <p className="text-ink-200 mt-2">Each quarter gets a mood — renewal, outward, abundant, gathered. Themes are pulled from that mood, then bent toward the brand's voice.</p>
          </div>
          <div>
            <Eyebrow>Objective coverage</Eyebrow>
            <p className="text-ink-200 mt-2">One awareness, one consideration, one conversion campaign. So the budget pyramids correctly across the quarter.</p>
          </div>
          <div>
            <Eyebrow>Audience layering</Eyebrow>
            <p className="text-ink-200 mt-2">Audiences come from the industry's pre-baked profiles, then re-sampled per idea so no two ideas in a campaign share the same audience.</p>
          </div>
        </Card>
      </Section>
    </div>
  );
}
