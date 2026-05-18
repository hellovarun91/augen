import Link from "next/link";
import { usageTotals } from "@/lib/agents/persistence";
import { budgetUsd, formatUsd } from "@/lib/agents/pricing";

export async function UsageChip() {
  const since = Date.now() - 30 * 86400_000;
  const totals = usageTotals({ since });
  const budget = budgetUsd();
  const pct = budget ? Math.min(1, (totals.cost_micros / 1e6) / budget) : null;
  const tone = pct == null ? "neutral" : pct > 0.85 ? "danger" : pct > 0.6 ? "warn" : "ok";
  return (
    <Link href="/usage" className="block rounded-xl ring-1 ring-white/10 bg-ink-900/60 px-3 py-2 hover:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">30-day usage</div>
          <div className="text-sm text-ink-100">{formatUsd(totals.cost_micros)}</div>
        </div>
        <div className="text-right text-[10px] text-ink-400">
          {budget != null ? <div>of ${budget.toFixed(0)}</div> : <div>no budget</div>}
          <div>{Math.round((totals.tokens_in + totals.tokens_out) / 1000)}K tok</div>
        </div>
      </div>
      {budget != null && pct != null && (
        <div className="mt-1.5 h-1 w-full rounded-full bg-ink-800 overflow-hidden">
          <div
            className={"h-full " + (tone === "danger" ? "bg-rose-500" : tone === "warn" ? "bg-amber-400" : "bg-emerald-400")}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      )}
    </Link>
  );
}
