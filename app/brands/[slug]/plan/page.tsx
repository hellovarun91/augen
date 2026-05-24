import { Card, Eyebrow, Section } from "@/components/ui/primitives";
import { getBrandBySlug } from "@/lib/repo";
import { planQuarter } from "@/lib/ai/planner";
import { notFound } from "next/navigation";
import { SyncActiveBrand } from "@/components/sync-active-brand";
import { PlannerControls, PlannerWorkspace, type Proposal } from "./controls";

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
  const count = Math.max(1, Math.min(6, parseInt(sp.count || "3", 10) || 3));

  // Money (budget/KPIs/channels) intentionally dropped — the studio stays design-first.
  const proposals: Proposal[] = planQuarter(brand, year, quarter, count).map((p, i) => ({
    id: String(i),
    name: p.name,
    objective: p.objective,
    audience: p.audience,
    productFocus: p.productFocus,
    rationale: p.rationale,
    ideas: p.ideas,
  }));

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-8">
      <SyncActiveBrand brandId={brand.id} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div>
          <Eyebrow>{brand.name} · AI planner</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">Draft a few projects</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            A starting set for {quarter} {year} — one to build awareness, one to nurture, one to convert. Rename them, drop what
            you don't want, then add the rest to your Studio. You can always create projects by hand too.
          </p>
        </div>
        <PlannerControls slug={brand.slug} currentQ={quarter} currentYear={year} currentCount={count} />
      </div>

      <PlannerWorkspace brandId={brand.id} proposals={proposals} />

      <Section title="How the planner thinks">
        <Card className="p-6 grid md:grid-cols-3 gap-6 text-sm">
          <div>
            <Eyebrow>A seasonal mood</Eyebrow>
            <p className="text-ink-200 mt-2">Each quarter has a feel — renewal, outward, abundant, gathered. Themes start there, then bend toward your brand's voice.</p>
          </div>
          <div>
            <Eyebrow>A natural arc</Eyebrow>
            <p className="text-ink-200 mt-2">One project to get noticed, one to build interest, one to convert — so the work compounds across the season.</p>
          </div>
          <div>
            <Eyebrow>Layered audiences</Eyebrow>
            <p className="text-ink-200 mt-2">Audiences are drawn from your industry's profiles, then varied per idea so no two ideas chase the same person.</p>
          </div>
        </Card>
      </Section>
    </div>
  );
}
