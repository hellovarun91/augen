"use client";
import { Button, Card, Eyebrow, Input, Label } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { runCampaignAction, runStrategistAction } from "../actions";

export function AgentRunControls({ campaignId, ideasCount }: { campaignId: string; ideasCount: number }) {
  const [pending, start] = useTransition();
  const [count, setCount] = useState(4);
  const [strategyNotes, setStrategyNotes] = useState("");
  const [copyConstraint, setCopyConstraint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function fire(name: string, fn: () => Promise<unknown>) {
    setError(null);
    setInfo(null);
    start(async () => {
      try {
        await fn();
        setInfo(`${name} completed.`);
      } catch (e: any) {
        setError(e?.message || `${name} failed`);
      }
    });
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Operator controls</Eyebrow>
          <div className="serif text-xl mt-1">Trigger an agent</div>
          <div className="text-xs text-ink-400 mt-1">Each click is one chain. Every agent in that chain writes its rationale and is rerunnable.</div>
        </div>
        {info && <div className="text-xs text-emerald-300">{info}</div>}
        {error && <div className="text-xs text-rose-300">{error}</div>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl ring-1 ring-white/5 bg-ink-900/60 p-4 space-y-3">
          <div>
            <div className="text-sm text-ink-100">Strategist</div>
            <div className="text-xs text-ink-400">Generates fresh ideas using brand language and campaign brief.</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Count</Label>
              <select value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))} className="w-full rounded-lg bg-ink-800 px-2 py-1.5 text-sm ring-1 ring-inset ring-white/10">
                {[2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="space-y-1 col-span-1">
              <Label>Steer (optional)</Label>
              <Input value={strategyNotes} onChange={(e) => setStrategyNotes(e.target.value)} placeholder="e.g. quieter, no maker stories" />
            </div>
          </div>
          <Button size="sm" disabled={pending} onClick={() => fire("Strategist", () => runStrategistAction(campaignId, { count, notes: strategyNotes }))}>
            {pending ? "Running…" : "Run Strategist →"}
          </Button>
        </div>

        <div className="rounded-xl ring-1 ring-white/5 bg-ink-900/60 p-4 space-y-3">
          <div>
            <div className="text-sm text-ink-100">Art Director → Copywriter → Critic</div>
            <div className="text-xs text-ink-400">Fans out across selected formats × variants, then scores each ad with a verdict.</div>
          </div>
          <div className="space-y-1">
            <Label>Copy constraint (optional)</Label>
            <Input value={copyConstraint} onChange={(e) => setCopyConstraint(e.target.value)} placeholder="e.g. shorter, lead with benefit, less precious" />
          </div>
          <Button size="sm" disabled={pending || ideasCount === 0} onClick={() => fire("Generate Ads", () => runCampaignAction(campaignId, copyConstraint || undefined))}>
            {pending ? "Running…" : "Generate ads via chain →"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
