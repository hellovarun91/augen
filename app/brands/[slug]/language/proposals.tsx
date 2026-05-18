"use client";
import { Badge, Button, Card, Empty, Eyebrow } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { runRuleRefinerAction, acceptProposalAction, dismissProposalAction } from "./actions";

interface Proposal {
  id: string;
  kind: "do" | "dont" | "preferred" | "banned";
  rule: string;
  evidence: string | null;
}

export function ProposalsPanel({ brandId, brandSlug, proposals }: { brandId: string; brandSlug: string; proposals: Proposal[] }) {
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refine() {
    setError(null); setInfo(null);
    start(async () => {
      try {
        const r = await runRuleRefinerAction(brandId, brandSlug);
        setInfo(`Refiner via ${r.provider}: ${r.proposals} new proposal${r.proposals === 1 ? "" : "s"}.`);
      } catch (e: any) { setError(e?.message || "Refiner failed"); }
    });
  }

  function act(id: string, action: "accept" | "dismiss") {
    start(async () => {
      if (action === "accept") await acceptProposalAction(id, brandSlug);
      else await dismissProposalAction(id, brandSlug);
    });
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Eyebrow>Rule Refiner</Eyebrow>
          <div className="text-xs text-ink-400 mt-1">Pulls recent reviewer notes, clusters with Claude, returns concrete rule candidates.</div>
        </div>
        <Button size="sm" variant="ghost" disabled={pending} onClick={refine}>{pending ? "Refining…" : "Run refiner →"}</Button>
      </div>
      {info && <div className="text-xs text-emerald-300">{info}</div>}
      {error && <div className="text-xs text-rose-300">{error}</div>}

      {proposals.length === 0 ? (
        <Empty title="No pending proposals">Run the refiner above. (Adds nothing if no reviewer notes exist yet.)</Empty>
      ) : (
        <ul className="space-y-2">
          {proposals.map((p) => (
            <li key={p.id} className="rounded-xl ring-1 ring-white/5 bg-ink-900/60 p-4">
              <div className="flex items-start gap-3">
                <Badge tone={p.kind === "do" ? "ok" : p.kind === "dont" ? "danger" : p.kind === "preferred" ? "info" : "warn"}>{p.kind}</Badge>
                <div className="flex-1">
                  <div className="text-sm text-ink-100">{p.rule}</div>
                  {p.evidence && <div className="text-[11px] text-ink-400 mt-1 italic">{p.evidence}</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => act(p.id, "accept")} className="text-xs rounded-full px-2.5 py-1 ring-1 ring-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25">Accept</button>
                  <button onClick={() => act(p.id, "dismiss")} className="text-xs rounded-full px-2.5 py-1 ring-1 ring-white/10 text-ink-300 hover:bg-white/10">Dismiss</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
