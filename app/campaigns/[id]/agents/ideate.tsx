"use client";
import { Button, Card, Eyebrow } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { runStrategistAction, addIdeaToCopySheetAction, removeIdeaAction } from "../actions";

export interface IdeaLite {
  id: string; theme: string; insight: string | null; angle: string;
  audience: string; promise: string | null; hooks: string[];
}

export function Ideate({ campaignId, ideas, promotedIdeaIds }: {
  campaignId: string; ideas: IdeaLite[]; promotedIdeaIds: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [direction, setDirection] = useState("");
  const [count, setCount] = useState(4);
  const [promoted, setPromoted] = useState<Set<string>>(new Set(promotedIdeaIds));
  const [busy, setBusy] = useState<string | null>(null); // "propose" | ideaId
  const [error, setError] = useState<string | null>(null);

  function propose() {
    setError(null); setBusy("propose");
    start(async () => {
      try { await runStrategistAction(campaignId, { count, notes: direction.trim() || undefined }); router.refresh(); }
      catch (e: any) { setError(e?.message || "Couldn't propose angles"); }
      finally { setBusy(null); }
    });
  }
  function addToSheet(ideaId: string) {
    setError(null); setBusy(ideaId);
    start(async () => {
      try { await addIdeaToCopySheetAction(campaignId, ideaId); setPromoted((s) => new Set(s).add(ideaId)); }
      catch (e: any) { setError(e?.message || "Couldn't add to the sheet"); }
      finally { setBusy(null); }
    });
  }
  function remove(ideaId: string) {
    setBusy(ideaId);
    start(async () => {
      try { await removeIdeaAction(campaignId, ideaId); router.refresh(); }
      catch (e: any) { setError(e?.message || "Couldn't remove"); }
      finally { setBusy(null); }
    });
  }

  return (
    <div className="space-y-6">
      {/* Direction — steer the AI, then propose angles. */}
      <Card className="p-6 space-y-4">
        <div>
          <Eyebrow>Direction</Eyebrow>
          <div className="serif text-xl mt-1">What are we working toward?</div>
          <div className="text-xs text-ink-400 mt-1">Give the angle, mood, or audience to explore. The Strategist proposes a few directions with its reasoning — keep the ones that resonate.</div>
        </div>
        <textarea
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
          rows={3}
          placeholder="e.g. Speak to career-switchers who feel behind — confident, not preachy. Lean on the certificate as proof."
          className="w-full rounded-xl bg-ink-900/60 px-3.5 py-3 text-sm text-ink-100 ring-1 ring-inset ring-white/10 focus:ring-white/25 resize-y placeholder:text-ink-600"
        />
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" onClick={propose} disabled={pending}>{busy === "propose" ? "Thinking…" : ideas.length ? "Propose more angles →" : "Propose angles →"}</Button>
          <label className="text-xs text-ink-400 flex items-center gap-2">
            How many
            <select value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))} className="rounded-lg bg-ink-800 px-2 py-1 text-sm ring-1 ring-inset ring-white/10">
              {[2, 3, 4, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {error && <span className="text-xs text-rose-300">{error}</span>}
        </div>
      </Card>

      {/* Angles — rationale-first, each can become a Copy Sheet row. */}
      {ideas.length === 0 ? (
        <div className="rounded-xl ring-1 ring-white/5 p-8 text-center text-sm text-ink-400">
          No angles yet. Set a direction above and propose a few — you'll see the reasoning behind each, and send the ones you like to the Copy Sheet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ideas.map((idea) => {
            const isPromoted = promoted.has(idea.id);
            return (
              <Card key={idea.id} className="p-5 space-y-3 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="serif text-lg leading-tight">{idea.theme}</div>
                  <span className="text-[10px] uppercase tracking-wider text-ink-500 shrink-0 mt-1">{idea.audience}</span>
                </div>
                {idea.insight && (
                  <p className="text-sm text-ink-300 leading-relaxed"><span className="text-ink-500">Why: </span>{idea.insight}</p>
                )}
                <p className="text-sm text-ink-200 leading-relaxed"><span className="text-ink-500">Angle: </span>{idea.angle}</p>
                {idea.promise && <p className="text-sm text-ink-300 leading-relaxed"><span className="text-ink-500">Promise: </span>{idea.promise}</p>}
                {idea.hooks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {idea.hooks.slice(0, 4).map((h, i) => (
                      <span key={i} className="rounded-full px-2.5 py-1 text-xs ring-1 ring-white/10 bg-white/5 text-ink-200">{h}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 pt-2 mt-auto border-t border-white/5">
                  {isPromoted ? (
                    <Link href={`/campaigns/${campaignId}/copy`} className="text-sm text-emerald-300 hover:text-emerald-200">Added ✓ · Open Copy Sheet →</Link>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => addToSheet(idea.id)} disabled={pending}>
                      {busy === idea.id ? "Adding…" : "Add to Copy Sheet →"}
                    </Button>
                  )}
                  <button onClick={() => remove(idea.id)} disabled={pending} className="text-xs text-ink-500 hover:text-rose-300 ml-auto">Remove</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
