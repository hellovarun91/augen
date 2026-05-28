"use client";
import { Button, Card, Eyebrow, Label, TextArea } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { approveAd, rejectAd, requestRevision, toggleWinnerAction } from "./actions";

export function ReviewControls({
  generationId,
  status,
  isWinner,
}: {
  generationId: string;
  status: string;
  isWinner: boolean;
}) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  return (
    <Card className="p-5 space-y-4">
      <Eyebrow>Review</Eyebrow>
      <div className="flex gap-2">
        <Button onClick={() => start(async () => { await approveAd(generationId, note); })} disabled={pending} variant="primary">
          Approve
        </Button>
        <Button onClick={() => start(async () => { await requestRevision(generationId, note); })} disabled={pending} variant="secondary">
          Request revision
        </Button>
        <Button onClick={() => start(async () => { await rejectAd(generationId, note); })} disabled={pending} variant="danger">
          Reject
        </Button>
      </div>
      <div className="space-y-1.5">
        <Label>Reviewer note</Label>
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional — e.g., headline too long for mobile feed" />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-ink-400">Current: {status.replace("_", " ")}</div>
        <button
          onClick={() => start(async () => { await toggleWinnerAction(generationId, !isWinner); })}
          className={"text-[11px] rounded-full px-2.5 py-1 ring-1 transition-colors " + (isWinner ? "bg-amber-500/20 text-amber-200 ring-amber-500/40" : "bg-white/5 text-ink-300 ring-white/10 hover:bg-white/10")}
        >
          {isWinner ? "★ winner — feeds agents" : "Mark as winner"}
        </button>
      </div>
    </Card>
  );
}
