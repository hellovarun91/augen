"use client";
import { Button, Card, Input, Label } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { grantCreditsAction, setStatusAction, setTierAction, setFlagOverrideAction } from "../../actions";
import { TIERS, type Tier } from "@/lib/tiers";

export function UserActions({
  userId, status, tier, balance,
}: { userId: string; status: "active" | "disabled"; tier: Tier; balance: number }) {
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grant, setGrant] = useState(100);
  const [note, setNote] = useState("");
  const [tierChoice, setTierChoice] = useState<Tier>(tier);

  function exec(label: string, fn: () => Promise<unknown>) {
    setError(null); setInfo(null);
    start(async () => {
      try { await fn(); setInfo(`${label} ok`); }
      catch (e: any) { setError(e?.message || `${label} failed`); }
    });
  }

  return (
    <Card className="p-5 space-y-5">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <div className="flex gap-2">
            <Button size="sm" variant={status === "active" ? "primary" : "ghost"} disabled={pending || status === "active"} onClick={() => exec("Activate", () => setStatusAction(userId, "active"))}>Activate</Button>
            <Button size="sm" variant={status === "disabled" ? "danger" : "ghost"} disabled={pending || status === "disabled"} onClick={() => exec("Disable", () => setStatusAction(userId, "disabled"))}>Disable</Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Tier (current: {tier})</Label>
          <div className="flex gap-2">
            <select value={tierChoice} onChange={(e) => setTierChoice(e.target.value as Tier)} className="flex-1 rounded-lg bg-ink-800 px-2 py-1.5 text-xs ring-1 ring-inset ring-white/10">
              {(Object.keys(TIERS) as Tier[]).map((t) => <option key={t} value={t}>{TIERS[t].label} · {TIERS[t].monthlyGrant.toLocaleString()}/{TIERS[t].resetsMonthly ? "mo" : "trial"}</option>)}
            </select>
            <Button size="sm" variant="secondary" disabled={pending || tierChoice === tier} onClick={() => exec(`Tier → ${TIERS[tierChoice].label}`, () => setTierAction(userId, tierChoice))}>Apply</Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Grant credits (current balance: {balance.toLocaleString()})</Label>
          <div className="flex gap-2">
            <Input type="number" value={grant} onChange={(e) => setGrant(parseInt(e.target.value || "0", 10))} className="flex-1" />
            <Button size="sm" variant="primary" disabled={pending || grant <= 0} onClick={() => exec(`+${grant} credits`, () => grantCreditsAction(userId, grant, note))}>Grant</Button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Grant note (optional)</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Demo top-up" />
      </div>

      {info && <div className="text-xs text-emerald-300">{info}</div>}
      {error && <div className="text-xs text-rose-300">{error}</div>}
    </Card>
  );
}

export function FlagOverrideControls({ flagName, userId, current }: { flagName: string; userId: string; current: boolean | undefined }) {
  const [pending, start] = useTransition();
  function set(v: boolean | null) {
    start(async () => { await setFlagOverrideAction(flagName, userId, v); });
  }
  const pill = (label: string, active: boolean, onClick: () => void, tone: "ok" | "danger" | "neutral") => (
    <button onClick={onClick} disabled={pending} className={
      "text-[11px] rounded-full px-2.5 py-1 ring-1 transition-colors " +
      (active
        ? (tone === "ok" ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30" : tone === "danger" ? "bg-rose-500/15 text-rose-200 ring-rose-500/30" : "bg-white/5 text-ink-200 ring-white/10")
        : "bg-ink-800 text-ink-300 ring-white/10 hover:bg-ink-700")
    }>
      {label}
    </button>
  );
  return (
    <div className="flex gap-1.5 py-3">
      {pill("Inherit", current === undefined, () => set(null), "neutral")}
      {pill("Force on", current === true, () => set(true), "ok")}
      {pill("Force off", current === false, () => set(false), "danger")}
    </div>
  );
}
