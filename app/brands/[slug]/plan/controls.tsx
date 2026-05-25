"use client";
import { Badge, Button, Card, Eyebrow, Input, TextArea } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { addPlannedProjects, brainstormAction, type BrainstormProposal } from "./actions";

const GOAL_CHIPS = ["Launch a product", "Seasonal push", "Drive signups", "Promote an offer", "Grow awareness", "Win customers back"];
const OBJECTIVES = ["awareness", "consideration", "conversion", "retention", "launch"];

interface Item extends BrainstormProposal { included: boolean; custom: boolean }

export function PlannerClient({ brandId }: { brandId: string }) {
  const [phase, setPhase] = useState<"intent" | "results">("intent");
  const [goal, setGoal] = useState("");
  const [count, setCount] = useState(3);
  const [nonce, setNonce] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [lastGoal, setLastGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const selected = items.filter((i) => i.included);

  function hydrate(proposals: BrainstormProposal[]) {
    setItems(proposals.map((p) => ({ ...p, included: true, custom: false })));
  }

  function brainstorm(freshNonce = nonce) {
    const g = goal.trim();
    if (g.length < 2) { setError("Tell the planner what you're working toward."); return; }
    setError(null);
    start(async () => {
      try {
        const proposals = await brainstormAction(brandId, g, count, freshNonce);
        hydrate(proposals);
        setLastGoal(g);
        setPhase("results");
      } catch (e: any) { setError(e?.message || "Could not brainstorm"); }
    });
  }
  function regenerate() {
    const next = nonce + 1;
    setNonce(next);
    brainstorm(next);
  }

  function setField(id: string, patch: Partial<Item>) { setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i))); }
  function toggle(id: string) { setItems((s) => s.map((i) => (i.id === id ? { ...i, included: !i.included } : i))); }
  function addCustom() {
    setItems((s) => [...s, { id: `custom-${Date.now()}`, name: "", objective: "awareness", audience: "", productFocus: [], rationale: "Your own draft — shape it however you like.", ideas: [], included: true, custom: true }]);
  }
  function removeCustom(id: string) { setItems((s) => s.filter((i) => i.id !== id)); }

  function addSelected() {
    setError(null);
    start(async () => {
      try {
        await addPlannedProjects(brandId, selected.map((i) => ({ name: i.name, objective: i.objective, audience: i.audience, productFocus: i.productFocus, ideas: i.ideas })));
      } catch (e: any) {
        if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
        setError(e?.message || "Could not add projects");
      }
    });
  }

  // ---- Intent phase ----
  if (phase === "intent") {
    return (
      <Card className="p-6 md:p-8 space-y-5">
        <div>
          <h2 className="serif text-2xl tracking-tight">What are you working toward?</h2>
          <p className="text-sm text-ink-300 mt-1">Tell the planner the goal in your words. It turns that into a few build-ready projects — each one becomes a Project you generate ads in.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {GOAL_CHIPS.map((c) => (
            <button key={c} type="button" onClick={() => setGoal(c)}
              className="rounded-full px-3 py-1.5 text-xs ring-1 ring-white/10 text-ink-200 hover:bg-white/5">{c}</button>
          ))}
        </div>
        <TextArea
          rows={3}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); brainstorm(); } }}
          placeholder="e.g. Spring launch of the new citrus line — push free samples and first-order signups."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => brainstorm()} disabled={pending || goal.trim().length < 2}>{pending ? "Brainstorming…" : "Brainstorm projects →"}</Button>
          <label className="text-xs text-ink-400 flex items-center gap-2">
            How many
            <select value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))} className="rounded-lg bg-ink-800 px-2 py-1 text-sm text-ink-50 ring-1 ring-inset ring-white/10">
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {error && <span className="text-xs text-rose-300">{error}</span>}
        </div>
      </Card>
    );
  }

  // ---- Results phase ----
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-sm text-ink-300">
          <span className="text-ink-100">{items.length} idea{items.length === 1 ? "" : "s"}</span> for <span className="text-ink-100">"{lastGoal}"</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setPhase("intent"); setError(null); }} className="text-xs text-ink-400 hover:text-ink-100">← Change goal</button>
          <Button size="sm" variant="ghost" onClick={regenerate} disabled={pending}>{pending ? "Thinking…" : "⟳ Give me different ones"}</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {items.map((p) => (
          <Card key={p.id} className={"p-5 space-y-4 transition-opacity " + (p.included ? "" : "opacity-45")}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={p.included} onChange={() => toggle(p.id)} className="mt-1.5" />
              <div className="flex-1 min-w-0 space-y-2">
                {p.custom ? (
                  <div className="flex items-center gap-2">
                    <select value={p.objective} onChange={(e) => setField(p.id, { objective: e.target.value })} className="rounded-md bg-ink-800 px-2 py-1 text-[11px] text-ink-100 ring-1 ring-inset ring-white/10 capitalize">
                      {OBJECTIVES.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <Badge tone="neutral">your draft</Badge>
                    <button onClick={() => removeCustom(p.id)} className="ml-auto text-[11px] text-ink-500 hover:text-rose-300">remove</button>
                  </div>
                ) : (
                  <Badge tone="info" className="capitalize">{p.objective}</Badge>
                )}
                <Input value={p.name} onChange={(e) => setField(p.id, { name: e.target.value })} placeholder={p.custom ? "Name this project" : undefined} className="serif !text-lg" />
                {p.custom ? (
                  <Input value={p.audience} onChange={(e) => setField(p.id, { audience: e.target.value })} placeholder="Who is it for?" className="!text-xs" />
                ) : (
                  <div className="text-xs text-ink-400">{p.audience}</div>
                )}
              </div>
            </div>
            <p className="text-sm text-ink-200 leading-relaxed line-clamp-3">{p.rationale}</p>
            <div>
              <Eyebrow>Idea seeds</Eyebrow>
              {p.ideas.length === 0 ? (
                <p className="text-[11px] text-ink-500 mt-2">No seeds yet — generate ideas in the Studio after you add this.</p>
              ) : (
                <ul className="space-y-2 mt-2">
                  {p.ideas.slice(0, 3).map((idea, j) => (
                    <li key={j} className="rounded-lg ring-1 ring-white/5 bg-ink-900/60 p-2.5">
                      <div className="serif text-sm">{idea.theme}</div>
                      <div className="text-[11px] text-ink-400 mt-0.5">{idea.angle}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        ))}

        <button onClick={addCustom} className="rounded-2xl ring-1 ring-dashed ring-white/15 p-5 text-sm text-ink-400 hover:text-ink-100 hover:ring-white/30 transition-colors min-h-[180px] flex items-center justify-center">
          + Add your own draft
        </button>
      </div>

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl bg-ink-900/90 backdrop-blur ring-1 ring-white/10 px-4 py-3">
        <div className="text-sm text-ink-300">
          {selected.length === 0 ? "Tick the ones you want — rename or reshape any first." : `${selected.length} project${selected.length === 1 ? "" : "s"} → your Studio`}
          {error && <span className="text-rose-300 ml-2">{error}</span>}
        </div>
        <Button onClick={addSelected} disabled={pending || selected.length === 0}>
          {pending ? "Adding…" : `Add ${selected.length || ""} to Studio`}
        </Button>
      </div>
    </div>
  );
}
