"use client";
import { Button } from "@/components/ui/primitives";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { acceptPlan } from "./actions";

export function PlannerControls({ slug, currentQ, currentYear }: { slug: string; currentQ: string; currentYear: number }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={currentQ}
        onChange={(e) => router.push(`/brands/${slug}/plan?q=${e.target.value}&year=${currentYear}`)}
        className="rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10"
      >
        {["Q1", "Q2", "Q3", "Q4"].map((q) => <option key={q} value={q}>{q}</option>)}
      </select>
      <select
        defaultValue={currentYear}
        onChange={(e) => router.push(`/brands/${slug}/plan?q=${currentQ}&year=${e.target.value}`)}
        className="rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10"
      >
        {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

export function AcceptPlanForm({ brandId, quarter, year }: { brandId: string; quarter: string; year: number }) {
  const [pending, start] = useTransition();
  return (
    <form action={(fd) => start(async () => { await acceptPlan(brandId, quarter, year); })}>
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>{pending ? "Adding…" : `Accept ${quarter} ${year} plan →`}</Button>
        <div className="text-xs text-ink-400">Adds 3 campaigns and 12 idea seeds. Idempotent — re-accepting refreshes nothing.</div>
      </div>
    </form>
  );
}
