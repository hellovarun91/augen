import { Badge, Card, Empty, Eyebrow, Section, Stat } from "@/components/ui/primitives";
import { ensureCredits, listCreditTxns, PRICING, TIERS, type Tier } from "@/lib/credits";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { topUpAction, changeTierAction } from "./actions";
import { relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CreditsPage() {
  const { user } = await getSession();
  if (!user) redirect("/signin");
  const row = ensureCredits(user.id);
  const tier = TIERS[row.tier];
  const txns = listCreditTxns(user.id, 30);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div>
          <Eyebrow>Your credits · {tier.label}</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">{row.balance.toLocaleString()} credits left.</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            One credit ≈ $0.02 of underlying AI cost. Tweak any ad inline — that's free. The chain only spends when it has to.
          </p>
        </div>
        <Badge tone="info">{tier.resetsMonthly ? `${tier.monthlyGrant.toLocaleString()} / month` : "trial"}</Badge>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5"><Stat label="Balance" value={row.balance.toLocaleString()} sub="credits available" /></Card>
        <Card className="p-5"><Stat label="Lifetime used" value={row.lifetime_used.toLocaleString()} sub="since sign-up" /></Card>
        <Card className="p-5"><Stat label={tier.resetsMonthly ? "Resets" : "Top-up next"} value={tier.resetsMonthly ? new Date(row.period_end).toLocaleDateString() : "anytime"} sub={tier.resetsMonthly ? "automatic" : "manual"} /></Card>
      </div>

      <Section title="Tiers" subtitle="Pick a plan. Mock billing — no real charge.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(TIERS) as Tier[]).map((t) => {
            const def = TIERS[t];
            const active = t === row.tier;
            return (
              <form key={t} action={changeTierAction.bind(null, t)}>
                <Card className={"p-5 " + (active ? "ring-emerald-500/40" : "")}>
                  <div className="flex items-start justify-between">
                    <div className="serif text-xl">{def.label}</div>
                    {active && <Badge tone="ok">current</Badge>}
                  </div>
                  <div className="text-xl mt-2">
                    {def.pricePerMonthUsd == null ? "Custom" : def.pricePerMonthUsd === 0 ? "Free" : `$${def.pricePerMonthUsd}/mo`}
                  </div>
                  <div className="text-xs text-ink-400 mt-1">{def.monthlyGrant.toLocaleString()} credits{def.resetsMonthly ? " / mo" : ""}</div>
                  <p className="text-xs text-ink-300 mt-3 leading-relaxed">{def.description}</p>
                  {!active && (
                    <button className="mt-4 w-full rounded-full bg-ink-700 hover:bg-ink-600 text-ink-50 text-xs px-3 py-1.5">Switch (mock)</button>
                  )}
                </Card>
              </form>
            );
          })}
        </div>
      </Section>

      <Section title="Actions & costs" subtitle="What each AI step costs in credits. Everything else (custom edits, approvals, export) is free.">
        <div className="grid md:grid-cols-2 gap-3">
          {[
            ["Generate ads (per ad, Claude only)", PRICING.generate_ad_claude, "Strategist + Art Director + Copywriter + QC Critic per ad"],
            ["Generate ads (per ad, with image gen)", PRICING.generate_ad_claude + PRICING.generate_ad_image, "Adds Gemini Nano Banana 2 per ad"],
            ["Strategist (one run)", PRICING.strategist, "Drafts the campaign ideas"],
            ["Spin variants (one batch)", PRICING.spin_variants, "Copywriter spins 4–20 variants in Copy Lab"],
            ["Rule refiner", PRICING.rule_refiner, "Clusters reviewer notes into Do/Don't proposals"],
            ["Token extraction", PRICING.token_extract, "Claude vision → BrandTokens JSON"],
            ["Image generate (standalone)", PRICING.image_generate, "Generate a single brand reference image"],
            ["Stock search", PRICING.stock_search, "One Pexels query"],
            ["Critic preview", PRICING.critic_preview, "Stress-test a candidate line on the language page"],
          ].map(([label, cost, hint]) => (
            <Card key={label as string} className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-ink-100">{label}</div>
                <div className="text-[11px] text-ink-400 mt-0.5">{hint}</div>
              </div>
              <Badge>{cost} credits</Badge>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Recent transactions">
        {txns.length === 0 ? (
          <Empty title="No activity yet">Run something to see usage here.</Empty>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-400">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th className="text-left">Kind</th>
                  <th className="text-left">Description</th>
                  <th className="text-right pr-4">Credits</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-ink-300">{relativeDate(t.created_at)}</td>
                    <td><Badge tone={t.kind === "charge" ? "danger" : t.kind === "grant" ? "ok" : "info"}>{t.kind}</Badge></td>
                    <td className="text-ink-200">{t.description}</td>
                    <td className={"text-right pr-4 " + (t.amount < 0 ? "text-rose-200" : "text-emerald-200")}>{t.amount > 0 ? "+" : ""}{t.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>

      <Section title="Top up (mock)" subtitle="No real payment — adds credits instantly for testing.">
        <form action={topUpAction.bind(null, 100)} className="inline-block mr-2">
          <button className="rounded-full bg-ink-700 hover:bg-ink-600 text-ink-50 text-xs px-3 py-1.5">+100 credits</button>
        </form>
        <form action={topUpAction.bind(null, 500)} className="inline-block mr-2">
          <button className="rounded-full bg-ink-700 hover:bg-ink-600 text-ink-50 text-xs px-3 py-1.5">+500 credits</button>
        </form>
        <form action={topUpAction.bind(null, 2000)} className="inline-block">
          <button className="rounded-full bg-ink-700 hover:bg-ink-600 text-ink-50 text-xs px-3 py-1.5">+2,000 credits</button>
        </form>
      </Section>
    </div>
  );
}
