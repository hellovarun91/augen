"use client";
import { Button, Card, Eyebrow, Label, TextArea, Input } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { approveAd, rejectAd, requestRevision, saveCopy } from "./actions";

export function ReviewControls({
  generationId,
  status,
  initial,
}: {
  generationId: string;
  status: string;
  initial: { headline: string; subhead: string; cta: string; eyebrow: string };
}) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [copy, setCopy] = useState(initial);
  const [saved, setSaved] = useState(false);

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
      <div className="text-[11px] text-ink-400">Current: {status.replace("_", " ")}</div>

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
            <Button size="sm" onClick={() => start(async () => { await saveCopy(generationId, copy); setSaved(true); setTimeout(() => setSaved(false), 1500); })}>
              {pending ? "Saving…" : "Save copy"}
            </Button>
            {saved && <span className="text-xs text-emerald-300 ml-2">Saved.</span>}
          </div>
        )}
      </div>
    </Card>
  );
}
