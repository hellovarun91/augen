import { Badge, Card, Empty, Eyebrow, Section, Stat } from "@/components/ui/primitives";
import { usageBreakdown, usagePerBrand, usageTotals } from "@/lib/agents/persistence";
import { budgetUsd, formatUsd, getPricing } from "@/lib/agents/pricing";
import { getBrand } from "@/lib/repo";
import Link from "next/link";

export const dynamic = "force-dynamic";

const AGENT_NAMES: Record<string, string> = {
  strategist: "Strategist",
  art_director: "Art Director",
  copywriter: "Copywriter",
  critic: "QC Critic",
};

export default function UsagePage({ searchParams }: { searchParams?: Promise<Record<string, string>> }) {
  return UsageContent(searchParams);
}

async function UsageContent(spPromise?: Promise<Record<string, string>>) {
  const sp = (await spPromise) || {};
  const period = sp.period || "month";
  const since = sinceMs(period);
  const all = usageTotals({ since });
  const breakdown = usageBreakdown({ since });
  const perBrand = usagePerBrand();
  const pricing = getPricing();
  const budget = budgetUsd();
  const budgetSpent = budget ? Math.min(1, (all.cost_micros / 1e6) / budget) : null;
  const realRows = breakdown.filter((r) => r.provider !== "mock");

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto space-y-12">
      <div className="flex items-end justify-between gap-6">
        <div>
          <Eyebrow>Studio usage</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">Tokens, cost, and budget.</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            Real Claude calls are tracked per agent — input, output, cache-write, cache-read tokens. Mock runs cost nothing and are surfaced separately so the math is honest.
          </p>
        </div>
        <PeriodSwitcher current={period} />
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-5"><Stat label={`Cost (${period})`} value={formatUsd(all.cost_micros)} sub={`${realRows.reduce((s, r) => s + r.runs, 0)} real runs`} /></Card>
        <Card className="p-5"><Stat label="Input tokens" value={fmtTok(all.tokens_in)} sub={fmtTok(all.cache_create) + " written to cache"} /></Card>
        <Card className="p-5"><Stat label="Output tokens" value={fmtTok(all.tokens_out)} /></Card>
        <Card className="p-5"><Stat label="Cache reads" value={fmtTok(all.cache_read)} sub="cheaper than fresh input" /></Card>
      </div>

      {budget != null ? (
        <Card className="p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <Eyebrow>Budget (ANTHROPIC_BUDGET_USD)</Eyebrow>
              <div className="serif text-2xl mt-1">{formatUsd(all.cost_micros)} <span className="text-ink-400 text-base">of ${budget.toFixed(2)}</span></div>
            </div>
            <Badge tone={budgetSpent! > 0.85 ? "danger" : budgetSpent! > 0.6 ? "warn" : "ok"}>
              {(budgetSpent! * 100).toFixed(1)}% used
            </Badge>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-ink-800 ring-1 ring-white/5 overflow-hidden">
            <div
              className={"h-full " + (budgetSpent! > 0.85 ? "bg-rose-500" : budgetSpent! > 0.6 ? "bg-amber-400" : "bg-emerald-400")}
              style={{ width: `${budgetSpent! * 100}%` }}
            />
          </div>
        </Card>
      ) : (
        <Card className="p-5 text-sm text-ink-300">
          Set <code className="text-ink-100">ANTHROPIC_BUDGET_USD</code> in <code>.env.local</code> to see a budget bar here.
          Pricing today: ${pricing.input.toFixed(2)}/MTok in · ${pricing.output.toFixed(2)}/MTok out · ${pricing.cacheWrite.toFixed(2)}/MTok cache-write · ${pricing.cacheRead.toFixed(2)}/MTok cache-read.
          Override any rate with <code>ANTHROPIC_PRICE_IN_PER_MTOK</code>, etc.
        </Card>
      )}

      <Section title="By agent" subtitle={`${period === "month" ? "Last 30 days" : period === "week" ? "Last 7 days" : "All time"}`}>
        {breakdown.length === 0 ? (
          <Empty title="No usage yet">Run a campaign or the Strategist to populate this view.</Empty>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-400">
                <tr>
                  <th className="px-4 py-3 text-left">Agent</th>
                  <th className="text-left">Provider</th>
                  <th className="text-right">Runs</th>
                  <th className="text-right">In</th>
                  <th className="text-right">Out</th>
                  <th className="text-right">Cache write</th>
                  <th className="text-right">Cache read</th>
                  <th className="text-right pr-4">Cost</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((r, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-4 py-3 text-ink-100">{AGENT_NAMES[r.kind] || r.kind}</td>
                    <td><Badge tone={r.provider === "mock" ? "neutral" : "info"}>{r.provider}</Badge></td>
                    <td className="text-right text-ink-200">{r.runs}</td>
                    <td className="text-right text-ink-200">{fmtTok(r.tokens_in)}</td>
                    <td className="text-right text-ink-200">{fmtTok(r.tokens_out)}</td>
                    <td className="text-right text-ink-200">{fmtTok(r.cache_create)}</td>
                    <td className="text-right text-ink-200">{fmtTok(r.cache_read)}</td>
                    <td className="text-right text-ink-100 pr-4">{formatUsd(r.cost_micros)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>

      <Section title="By brand">
        {perBrand.length === 0 ? (
          <Empty title="No real-API usage yet">Brands using mock won't appear here.</Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {perBrand.map((r: any) => {
              const b = getBrand(r.brand_id);
              if (!b) return null;
              return (
                <Card key={r.brand_id} className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${b.tokens.palette.primary}, ${b.tokens.palette.accent})` }} />
                      <div>
                        <Link href={`/brands/${b.slug}`} className="serif text-lg hover:underline">{b.name}</Link>
                        <div className="text-xs text-ink-400">{r.runs} runs</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl">{formatUsd(r.cost_micros)}</div>
                      <div className="text-[11px] text-ink-400">{fmtTok(r.tokens_in + r.tokens_out)} tokens</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Section>
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

function fmtTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}
