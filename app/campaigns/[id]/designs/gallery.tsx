"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button, Eyebrow } from "@/components/ui/primitives";
import { approveDesignAction, requestChangesDesignAction } from "./actions";

interface DesignItem { id: string; aspect: string; headline: string; status: string; stale: number }
interface Group { rowId: string | null; name: string; rowApproved: boolean; designs: DesignItem[] }

const STATE: Record<string, { label: string; cls: string }> = {
  approved: { label: "approved", cls: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20" },
  needs_revision: { label: "needs changes", cls: "bg-amber-400/10 text-amber-200 ring-amber-400/20" },
  rejected: { label: "rejected", cls: "bg-rose-400/10 text-rose-200 ring-rose-400/20" },
  pending_review: { label: "needs review", cls: "bg-white/5 text-ink-300 ring-white/10" },
};

export function DesignGallery({ campaignId, groups }: { campaignId: string; groups: Group[] }) {
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(groups.flatMap((g) => g.designs.map((d) => [d.id, d.status]))),
  );
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function act(genId: string, next: "approved" | "needs_revision") {
    setBusy(genId);
    start(async () => {
      try {
        if (next === "approved") await approveDesignAction(campaignId, genId);
        else await requestChangesDesignAction(campaignId, genId);
        setStatuses((s) => ({ ...s, [genId]: next }));
      } finally { setBusy(null); }
    });
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl ring-1 ring-white/5 p-8 text-center text-sm text-ink-400">
        No designs yet. Head to the <Link href={`/campaigns/${campaignId}/copy`} className="text-ink-200 hover:text-white">Copy Sheet</Link> and Generate designs from your variations.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map((g) => (
        <div key={g.rowId || "standalone"} className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <Eyebrow>{g.rowId ? "Variation" : "Other creatives"}</Eyebrow>
              <div className="serif text-lg mt-0.5">{g.name}</div>
            </div>
            {g.rowId && (
              <span className={"text-[11px] rounded-full px-2.5 py-1 ring-1 " + (g.rowApproved ? "bg-emerald-400/10 text-emerald-200 ring-emerald-400/20" : "bg-white/5 text-ink-400 ring-white/10")}>
                {g.rowApproved ? "copy approved" : "copy not approved yet"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {g.designs.map((d) => {
              const status = statuses[d.id] || d.status;
              const ready = status === "approved" && !d.stale && (g.rowId ? g.rowApproved : true);
              const tone = d.stale ? { label: "stale — re-render", cls: "bg-amber-400/10 text-amber-200 ring-amber-400/20" } : (STATE[status] || STATE.pending_review);
              return (
                <div key={d.id} className="rounded-xl ring-1 ring-white/10 overflow-hidden bg-ink-900/40 flex flex-col">
                  <Link href={`/ads/${d.id}`} className="block bg-ink-950/60 aspect-[4/3] flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/render/${d.id}/png?w=400`} alt={d.aspect} loading="lazy" className="max-h-full max-w-full object-contain" />
                  </Link>
                  <div className="p-3 space-y-2 flex-1 flex flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-ink-400 tabular-nums">{d.aspect}</span>
                      {ready
                        ? <span className="text-[11px] rounded-full px-2 py-0.5 ring-1 bg-emerald-400/15 text-emerald-200 ring-emerald-400/30">ready to ship</span>
                        : <span className={"text-[11px] rounded-full px-2 py-0.5 ring-1 " + tone.cls}>{tone.label}</span>}
                    </div>
                    <div className="text-xs text-ink-200 line-clamp-2 leading-snug flex-1">{d.headline.replace(/\n/g, " ")}</div>
                    {d.stale ? (
                      <Link href={`/campaigns/${campaignId}/copy`} className="text-[11px] text-amber-300 hover:text-amber-200">Re-render in Copy Sheet →</Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        {status === "approved" ? (
                          <button onClick={() => act(d.id, "needs_revision")} disabled={pending} className="text-[11px] text-ink-400 hover:text-white">Un-approve</button>
                        ) : (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => act(d.id, "approved")} disabled={pending}>{busy === d.id ? "…" : "Approve"}</Button>
                            <button onClick={() => act(d.id, "needs_revision")} disabled={pending} className="text-[11px] text-ink-400 hover:text-white">Needs changes</button>
                          </>
                        )}
                        <Link href={`/ads/${d.id}`} className="text-[11px] text-ink-400 hover:text-white ml-auto">Edit →</Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
