"use client";
import { Button } from "@/components/ui/primitives";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { approveAd, rejectAd } from "@/app/ads/[id]/actions";
import { deleteBatchAction } from "../actions";

export type GroupBy = "format" | "headline" | "cta" | "subhead" | "eyebrow" | "image";

export function BatchControls({
  batchId, campaignId, ideaId, ids, currentGroupBy,
}: {
  batchId: string; campaignId: string; ideaId: string; ids: string[]; currentGroupBy: GroupBy;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);

  function bulkApprove() {
    setInfo(null);
    start(async () => {
      let n = 0;
      for (const id of ids) {
        try { await approveAd(id, "Bulk-approved from variation batch"); n++; } catch {}
      }
      setInfo(`Approved ${n}.`);
      router.refresh();
    });
  }
  function bulkReject() {
    setInfo(null);
    start(async () => {
      let n = 0;
      for (const id of ids) {
        try { await rejectAd(id, "Bulk-rejected from variation batch"); n++; } catch {}
      }
      setInfo(`Rejected ${n}.`);
      router.refresh();
    });
  }
  function deleteBatch() {
    if (!confirm("Delete this batch and all its generations?")) return;
    start(async () => {
      await deleteBatchAction(batchId, campaignId, ideaId);
      router.push(`/campaigns/${campaignId}/ideas/${ideaId}/variations`);
    });
  }

  function setGroupBy(g: GroupBy) {
    router.push(`/campaigns/${campaignId}/ideas/${ideaId}/variations/${batchId}?groupBy=${g}`);
  }

  const groupings: GroupBy[] = ["format", "headline", "cta", "subhead", "eyebrow", "image"];

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl ring-1 ring-white/5 bg-ink-900/60 p-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-400">Group by:</span>
        <div className="flex gap-1 rounded-full bg-ink-900 ring-1 ring-white/10 p-1">
          {groupings.map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={"text-[11px] rounded-full px-3 py-1 " + (currentGroupBy === g ? "bg-ink-50 text-ink-950" : "text-ink-300 hover:bg-white/5")}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="primary" disabled={pending} onClick={bulkApprove}>Approve all</Button>
        <Button size="sm" variant="danger" disabled={pending} onClick={bulkReject}>Reject all</Button>
        <button onClick={deleteBatch} disabled={pending} className="text-[11px] text-ink-400 hover:text-rose-300">Delete batch</button>
      </div>
      {info && <div className="text-xs text-emerald-300 w-full">{info}</div>}
    </div>
  );
}
