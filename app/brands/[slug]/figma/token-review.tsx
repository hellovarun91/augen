"use client";
import { Badge, Button, Card, Eyebrow } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyTokenMappingAction, discardTokenMappingAction } from "./actions";

interface Slot { key: string; label: string; kind: "color" | "font" }
interface Var { name: string; value: string | number; type?: string }

const isHex = (v: any) => typeof v === "string" && /^#?[0-9a-f]{6}$/i.test(String(v).trim());

export function TokenReview({ brandId, slug, slots, vars, proposal, viaAI }: {
  brandId: string; slug: string; slots: Slot[]; vars: Var[]; proposal: Record<string, string>; viaAI: boolean;
}) {
  const [mapping, setMapping] = useState<Record<string, string>>(proposal);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const colorVars = vars.filter((v) => isHex(v.value));
  const fontVars = vars.filter((v) => typeof v.value === "string" && !isHex(v.value) && v.value.trim());
  const valueOf = (name: string) => vars.find((v) => v.name === name)?.value;

  function set(slot: string, varName: string) { setMapping((m) => ({ ...m, [slot]: varName })); }
  function apply() {
    setError(null);
    start(async () => {
      try { await applyTokenMappingAction(brandId, slug, mapping); router.refresh(); }
      catch (e: any) { setError(e?.message || "Could not apply"); }
    });
  }
  function discard() {
    start(async () => { try { await discardTokenMappingAction(brandId, slug); router.refresh(); } catch {} });
  }

  return (
    <Card className="p-6 space-y-4 ring-1 ring-indigo-400/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Eyebrow>Review tokens from Figma</Eyebrow>
          <p className="text-sm text-ink-300 mt-1">We read {vars.length} variables from your file and mapped them to Augen's slots. Adjust any, then apply — we'll remember it for next time.</p>
        </div>
        <Badge tone={viaAI ? "info" : "neutral"}>{viaAI ? "AI-proposed" : "auto-matched"}</Badge>
      </div>

      <div className="divide-y divide-white/5">
        {slots.map((slot) => {
          const opts = slot.kind === "color" ? colorVars : fontVars;
          const chosen = mapping[slot.key] || "";
          const val = chosen ? valueOf(chosen) : undefined;
          return (
            <div key={slot.key} className="flex items-center gap-3 py-2.5">
              <div className="w-32 shrink-0 text-sm text-ink-200">{slot.label}</div>
              {slot.kind === "color" && (
                <span className="w-6 h-6 rounded-md ring-1 ring-white/10 shrink-0" style={{ background: isHex(val) ? String(val) : "transparent" }} />
              )}
              <select
                value={chosen}
                onChange={(e) => set(slot.key, e.target.value)}
                className="flex-1 min-w-0 rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs text-ink-100 ring-1 ring-inset ring-white/10"
              >
                <option value="">— skip —</option>
                {opts.map((v) => <option key={v.name} value={v.name}>{v.name}{slot.kind === "color" ? ` (${v.value})` : ""}</option>)}
              </select>
              {slot.kind === "font" && <span className="text-[11px] text-ink-500 w-28 truncate">{val ? String(val) : ""}</span>}
            </div>
          );
        })}
      </div>

      {error && <div className="text-xs text-rose-300">{error}</div>}
      <div className="flex items-center gap-3">
        <Button onClick={apply} disabled={pending}>{pending ? "Applying…" : "Apply & remember"}</Button>
        <button onClick={discard} disabled={pending} className="text-xs text-ink-400 hover:text-ink-100">Discard</button>
      </div>
    </Card>
  );
}
