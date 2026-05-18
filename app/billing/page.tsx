import { Card, Eyebrow, Section, Stat, LinkButton, Empty, Button } from "@/components/ui/primitives";
import { listBrands, getBilling, listTransactions } from "@/lib/repo";
import { topUp } from "./actions";
import { formatCents, relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function BillingPage() {
  const brands = listBrands();
  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-10">
      <div>
        <Eyebrow>Studio finance · mock</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Billing</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Every generation costs a mocked $0.16. Top-up runs free; there's no real payment processor wired up. The shape is here so we can swap in Stripe later.
        </p>
      </div>

      {brands.length === 0 ? (
        <Empty title="No brand accounts yet">Onboard a brand to open a billing account.</Empty>
      ) : (
        <div className="space-y-6">
          {brands.map((b) => {
            const billing = getBilling(b.id);
            if (!billing) return null;
            const txns = listTransactions(b.id, 8);
            return (
              <Card key={b.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${b.tokens.palette.primary}, ${b.tokens.palette.accent})` }} />
                    <div>
                      <div className="serif text-xl tracking-tight">{b.name}</div>
                      <div className="text-xs text-ink-400">Plan: {billing.plan} · Monthly budget {formatCents(billing.monthly_budget_cents)}</div>
                    </div>
                  </div>
                  <form action={topUp.bind(null, b.id)} className="flex items-center gap-2">
                    <Button type="submit" variant="secondary" size="sm">Top up $250 (mock)</Button>
                  </form>
                </div>
                <div className="grid md:grid-cols-3 gap-4 mt-5">
                  <Stat label="Balance" value={formatCents(billing.balance_cents)} />
                  <Stat label="Used (recent)" value={formatCents(Math.max(0, txns.filter((t) => t.kind === "charge").reduce((s, t) => s + t.amount_cents, 0)))} />
                  <Stat label="Account opened" value={relativeDate(billing.created_at)} />
                </div>
                {txns.length > 0 && (
                  <div className="mt-6">
                    <Eyebrow>Recent transactions</Eyebrow>
                    <table className="w-full mt-2 text-sm">
                      <thead>
                        <tr className="text-left text-xs text-ink-400">
                          <th className="py-2">When</th><th>Kind</th><th>Description</th><th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txns.map((t) => (
                          <tr key={t.id} className="border-t border-white/5">
                            <td className="py-2 text-ink-300">{relativeDate(t.created_at)}</td>
                            <td className="text-ink-200">{t.kind}</td>
                            <td className="text-ink-200">{t.description}</td>
                            <td className="text-right text-ink-100">{t.kind === "charge" ? "−" : "+"}{formatCents(t.amount_cents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
