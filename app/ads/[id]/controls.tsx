"use client";
import { Button, Card, Eyebrow, Label, TextArea, Input } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { approveAd, rejectAd, requestRevision, saveCopy, applyCopyToSiblingsAction, toggleWinnerAction } from "./actions";

export function ReviewControls({
  generationId,
  status,
  initial,
  isWinner,
}: {
  generationId: string;
  status: string;
  initial: { headline: string; subhead: string; cta: string; eyebrow: string };
  isWinner: boolean;
}) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [copy, setCopy] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [siblings, setSiblings] = useState(0); // other sizes of this row, after a copy edit

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

      <div className="pt-3 border-t border-white/5">
        <button onClick={() => setEditing((v) => !v)} className="text-xs text-ink-300 hover:text-ink-100">
          {editing ? "Cancel edits" : "Edit copy →"}
        </button>
        {editing && (
          <div className="mt-3 space-y-2">
            <div className="space-y-1"><Label>Eyebrow</Label><Input value={copy.eyebrow} onChange={(e) => setCopy({ ...copy, eyebrow: e.target.value })} /></div>
            <div className="space-y-1"><Label>Headline (use line breaks)</Label><TextArea value={copy.headline} onChange={(e) => setCopy({ ...copy, headline: e.target.value })} rows={3} /></div>
            <div className="space-y-1"><Label>Subhead</Label><TextArea value={copy.subhead} onChange={(e) => setCopy({ ...copy, subhead: e.target.value })} rows={2} /></div>
            <div className="space-y-1"><Label>CTA</Label><Input value={copy.cta} onChange={(e) => setCopy({ ...copy, cta: e.target.value })} /></div>
            <Button size="sm" onClick={() => start(async () => { const r = await saveCopy(generationId, copy); setSiblings(r.siblingCount); setSaved(true); setTimeout(() => setSaved(false), 1500); })}>
              {pending ? "Saving…" : "Save copy"}
            </Button>
            {saved && <span className="text-xs text-emerald-300 ml-2">Saved to the row.</span>}
            {siblings > 0 && (
              <div className="mt-3 rounded-lg ring-1 ring-amber-400/20 bg-amber-400/5 p-2.5 text-xs text-amber-100 flex items-center justify-between gap-3">
                <span>The other {siblings} size{siblings === 1 ? "" : "s"} of this variation now lag this copy.</span>
                <Button size="sm" variant="secondary" disabled={pending}
                  onClick={() => start(async () => { await applyCopyToSiblingsAction(generationId); setSiblings(0); })}>
                  Apply to all sizes
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
