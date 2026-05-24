"use client";
import { Button, Eyebrow, Input, Label, TextArea } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { onboardBrand } from "./actions";

export function NewBrandForm({ presets }: { presets: { label: string; body: string }[] }) {
  const [brief, setBrief] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          try {
            await onboardBrand(fd);
          } catch (e: any) {
            setError(e?.message || "Failed to onboard");
          }
        });
      }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label>Brief</Label>
        <TextArea
          name="brief"
          rows={8}
          required
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Tanda is a small-batch kombucha brand making bright, low-sugar drinks. Quietly confident voice — calm, premium, considered…"
        />
        <div className="text-xs text-ink-400">Be specific about audience and voice. The more honest the brief, the better the system.</div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Brand name (optional override)</Label>
          <Input name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Augen picks one if blank" />
        </div>
        <div className="space-y-2">
          <Label>Auto-draft quarter</Label>
          <select
            name="autoDraft"
            defaultValue="next"
            className="w-full rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10"
          >
            <option value="next">Yes — draft 3 projects for the next quarter</option>
            <option value="none">No — just create the brand</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Eyebrow>Presets</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              type="button"
              key={p.label}
              onClick={() => { setBrief(p.body); setName(p.label); }}
              className="rounded-full px-3 py-1.5 text-xs ring-1 ring-white/10 text-ink-200 hover:bg-white/5"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-sm text-rose-300">{error}</div>}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Onboarding…" : "Onboard brand →"}
        </Button>
        <div className="text-xs text-ink-400">Takes ~1 second. Everything is editable after.</div>
      </div>
    </form>
  );
}
