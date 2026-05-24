"use client";
import { Badge, Button, Card, Eyebrow, Input } from "@/components/ui/primitives";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addPlannedProjects, type PlanPick } from "./actions";

export function PlannerControls({ slug, currentQ, currentYear, currentCount }: { slug: string; currentQ: string; currentYear: number; currentCount: number }) {
  const router = useRouter();
  const go = (q: string, year: number | string, count: number | string) => router.push(`/brands/${slug}/plan?q=${q}&year=${year}&count=${count}`);
  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={currentQ}
        onChange={(e) => go(e.target.value, currentYear, currentCount)}
        className="rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10"
      >
        {["Q1", "Q2", "Q3", "Q4"].map((q) => <option key={q} value={q}>{q}</option>)}
      </select>
      <select
        defaultValue={currentYear}
        onChange={(e) => go(currentQ, e.target.value, currentCount)}
        className="rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10"
      >
        {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select
        defaultValue={currentCount}
        onChange={(e) => go(currentQ, currentYear, e.target.value)}
        className="rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10"
        title="How many drafts to propose"
      >
        {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} draft{n === 1 ? "" : "s"}</option>)}
      </select>
    </div>
  );
}

export interface Proposal extends PlanPick { id: string; rationale: string; }

const OBJECTIVES = ["awareness", "consideration", "conversion", "retention", "launch"];

export function PlannerWorkspace({ brandId, proposals }: { brandId: string; proposals: Proposal[] }) {
  const [items, setItems] = useState(proposals.map((p) => ({ ...p, included: true, custom: false })));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const selected = items.filter((i) => i.included);

  function setField(id: string, patch: Partial<(typeof items)[number]>) { setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i))); }
  function setName(id: string, name: string) { setField(id, { name }); }
  function toggle(id: string) { setItems((s) => s.map((i) => (i.id === id ? { ...i, included: !i.included } : i))); }
  function addCustom() {
    const id = `custom-${Date.now()}`;
    setItems((s) => [...s, { id, name: "", objective: "awareness", audience: "", productFocus: [] as string[], rationale: "Your own draft — shape it however you like.", ideas: [], included: true, custom: true }]);
  }
  function removeCustom(id: string) { setItems((s) => s.filter((i) => i.id !== id)); }

  function addSelected() {
    setError(null);
    start(async () => {
      try {
        await addPlannedProjects(brandId, selected.map((i) => ({
          name: i.name, objective: i.objective, audience: i.audience, productFocus: i.productFocus, ideas: i.ideas,
        })));
      } catch (e: any) {
        if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
        setError(e?.message || "Could not add projects");
      }
    });
  }

  return (
    <div className="space-y-5">
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
                  <Badge tone="info">{p.objective}</Badge>
                )}
                <Input value={p.name} onChange={(e) => setName(p.id, e.target.value)} placeholder={p.custom ? "Name this project" : undefined} className="serif !text-lg" />
                {p.custom ? (
                  <Input value={p.audience} onChange={(e) => setField(p.id, { audience: e.target.value })} placeholder="Who is it for?" className="!text-xs" />
                ) : (
                  <div className="text-xs text-ink-400">{p.audience}</div>
                )}
              </div>
            </div>
            <p className="text-sm text-ink-200 leading-relaxed">{p.rationale}</p>
            <div>
              <Eyebrow>Idea seeds</Eyebrow>
              {p.ideas.length === 0 ? (
                <p className="text-[11px] text-ink-500 mt-2">No seeds yet — generate ideas in the Studio after you add this.</p>
              ) : (
                <ul className="space-y-2 mt-2">
                  {p.ideas.slice(0, 4).map((idea, j) => (
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
          {selected.length === 0 ? "Tick the drafts you want to keep — rename any of them first." : `${selected.length} project${selected.length === 1 ? "" : "s"} selected`}
          {error && <span className="text-rose-300 ml-2">{error}</span>}
        </div>
        <Button onClick={addSelected} disabled={pending || selected.length === 0}>
          {pending ? "Adding…" : `Add ${selected.length || ""} to Studio`}
        </Button>
      </div>
    </div>
  );
}
