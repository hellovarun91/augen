import Link from "next/link";
import { ensureCredits, TIERS } from "@/lib/credits";

export function CreditsChip({ userId }: { userId: string }) {
  const row = ensureCredits(userId);
  const tier = TIERS[row.tier];
  const pct = tier.monthlyGrant > 0 ? Math.min(1, 1 - row.balance / tier.monthlyGrant) : 0;
  const tone = pct >= 0.85 ? "danger" : pct >= 0.6 ? "warn" : "ok";
  return (
    <Link href="/credits" className="block rounded-xl ring-1 ring-white/10 bg-ink-900/60 px-3 py-2 hover:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400">{tier.label}</div>
          <div className="text-sm text-ink-100">{row.balance.toLocaleString()} credits</div>
        </div>
        <div className="text-right text-[10px] text-ink-400">
          <div>of {tier.monthlyGrant.toLocaleString()}</div>
          {tier.resetsMonthly ? <div>resets monthly</div> : <div>trial</div>}
        </div>
      </div>
      <div className="mt-1.5 h-1 w-full rounded-full bg-ink-800 overflow-hidden">
        <div
          className={"h-full " + (tone === "danger" ? "bg-rose-500" : tone === "warn" ? "bg-amber-400" : "bg-emerald-400")}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </Link>
  );
}
