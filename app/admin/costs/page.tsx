import { Badge, Card, Empty, Eyebrow, Section, Stat } from "@/components/ui/primitives";
import { getSession } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { notFound, redirect } from "next/navigation";
import { formatUsd } from "@/lib/agents/pricing";
import { getBrand, getCampaign } from "@/lib/repo";
import { getUser } from "@/lib/users";
import {
  spendTotals, spendToday, spendByCategory, spendByBrand, spendByCampaign, spendByUser,
  cacheSavingsMicros, creativeCountByBrand,
} from "@/lib/spend";
import Link from "next/link";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  reasoning: "Reasoning · Claude",
  image: "Image generation · Gemini",
  vision: "Vision · token extraction",
  stock: "Stock · Pexels",
};
const CATEGORY_COLOR: Record<string, string> = {
  reasoning: "bg-indigo-400",
  image: "bg-emerald-400",
  vision: "bg-amber-400",
  stock: "bg-sky-400",
};

export default async function CostsPage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  const { user } = await getSession();
  if (!user) redirect("/signin");
  if (!isAdmin(user)) notFound();

  const sp = (await searchParams) || {};
  const period = sp.period || "month";
  const since = sinceMs(period);
  const label = period === "week" ? "last 7 days" : period === "month" ? "last 30 days" : "all time";

  const totals = spendTotals(since);
  const today = spendToday();
  const byCategory = spendByCategory(since);
  const byBrand = spendByBrand(since);
  const byCampaign = spendByCampaign({ since });
  const byUser = spendByUser(since);
  const cacheSaved = cacheSavingsMicros(since);
  const creativeCounts = creativeCountByBrand();

  // Run-rate projection for the calendar month (only meaningful on the month view).
  const dayOfMonth = new Date().getDate();
  const projectedMicros = period === "month" && dayOfMonth > 0
    ? Math.round((totals.cost_micros / dayOfMonth) * 30)
    : null;

  const catMax = Math.max(1, ...byCategory.map((c) => c.cost_micros));

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div>
          <Eyebrow>Admin · cost</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">What we're burning.</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            Real API spend (COGS) across every provider — reasoning, image, vision, stock. Mock runs cost nothing and never appear here. This is your cost, not a price.
          </p>
        </div>
        <PeriodSwitcher current={period} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-5"><Stat label={`Total burn (${label})`} value={formatUsd(totals.cost_micros)} sub={`${totals.events} API calls`} /></Card>
        <Card className="p-5"><Stat label="Today" value={formatUsd(today)} /></Card>
        <Card className="p-5"><Stat label="Projected month" value={projectedMicros != null ? formatUsd(projectedMicros) : "—"} sub={projectedMicros != null ? "at current run-rate" : "switch to 30 days"} /></Card>
        <Card className="p-5"><Stat label="Saved by caching" value={formatUsd(cacheSaved)} sub="vs. uncached input" /></Card>
      </div>

      <Section title="By category" subtitle="Where the money goes, by provider and kind of work.">
        {byCategory.length === 0 ? (
          <Empty title="No spend yet">Real API calls will populate this once a brand runs on live keys (mock costs nothing).</Empty>
        ) : (
          <Card className="p-6 space-y-4">
            {byCategory.map((c, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-100">{CATEGORY_LABEL[c.category] || c.category}</span>
                  <span className="text-ink-200 tabular-nums">{formatUsd(c.cost_micros)} <span className="text-ink-500">· {c.qty} {c.category === "reasoning" ? "calls" : "items"}</span></span>
                </div>
                <div className="h-2 w-full rounded-full bg-ink-800 ring-1 ring-white/5 overflow-hidden">
                  <div className={"h-full " + (CATEGORY_COLOR[c.category] || "bg-ink-400")} style={{ width: `${(c.cost_micros / catMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </Section>

      <Section title="By brand" subtitle="Cost per brand, and what each finished creative costs to make.">
        {byBrand.length === 0 ? (
          <Empty title="No brand spend yet">Run a brand on live keys to see its burn here.</Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {byBrand.map((r) => {
              const b = getBrand(r.brand_id);
              if (!b) return null;
              const creatives = creativeCounts[r.brand_id] || 0;
              const perCreative = creatives > 0 ? r.cost_micros / creatives : null;
              return (
                <Card key={r.brand_id} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${b.tokens.palette.primary}, ${b.tokens.palette.accent})` }} />
                      <div>
                        <Link href={`/brands/${b.slug}`} className="serif text-lg hover:underline">{b.name}</Link>
                        <div className="text-xs text-ink-400">{creatives} creatives · {r.events} calls</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl tabular-nums">{formatUsd(r.cost_micros)}</div>
                      {perCreative != null && <div className="text-[11px] text-ink-400">{formatUsd(perCreative)}/creative</div>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <div className="grid md:grid-cols-2 gap-8">
        <Section title="By project" subtitle="Top spenders.">
          {byCampaign.length === 0 ? (
            <Empty title="No project spend yet">—</Empty>
          ) : (
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {byCampaign.slice(0, 12).map((r) => {
                    const c = getCampaign(r.campaign_id);
                    return (
                      <tr key={r.campaign_id} className="border-t border-white/5 first:border-t-0">
                        <td className="px-4 py-3">
                          {c ? <Link href={`/campaigns/${c.id}`} className="text-ink-100 hover:underline">{c.name}</Link> : <span className="text-ink-400">{r.campaign_id}</span>}
                          <div className="text-[11px] text-ink-400">{r.events} calls</div>
                        </td>
                        <td className="px-4 py-3 text-right text-ink-100 tabular-nums">{formatUsd(r.cost_micros)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </Section>

        <Section title="By tester" subtitle="Who's burning what during the free beta.">
          {byUser.length === 0 ? (
            <Empty title="No attributed spend yet">Spend gets attributed once testers generate on live keys.</Empty>
          ) : (
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {byUser.slice(0, 12).map((r) => {
                    const u = getUser(r.user_id);
                    return (
                      <tr key={r.user_id} className="border-t border-white/5 first:border-t-0">
                        <td className="px-4 py-3">
                          <div className="text-ink-100">{u?.name || "Unknown"}</div>
                          <div className="text-[11px] text-ink-400">{u?.email || r.user_id} · {r.events} calls</div>
                        </td>
                        <td className="px-4 py-3 text-right text-ink-100 tabular-nums">{formatUsd(r.cost_micros)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </Section>
      </div>
    </div>
  );
}

function PeriodSwitcher({ current }: { current: string }) {
  const options = [
    { v: "week", label: "7 days" },
    { v: "month", label: "30 days" },
    { v: "all", label: "All time" },
  ];
  return (
    <div className="flex gap-1 rounded-full bg-ink-900 ring-1 ring-white/10 p-1">
      {options.map((o) => (
        <Link
          key={o.v}
          href={`?period=${o.v}`}
          className={"text-xs rounded-full px-3 py-1 " + (o.v === current ? "bg-ink-50 text-ink-950" : "text-ink-300 hover:bg-white/5")}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

function sinceMs(period: string): number | undefined {
  if (period === "week") return Date.now() - 7 * 86400_000;
  if (period === "month") return Date.now() - 30 * 86400_000;
  return undefined;
}
