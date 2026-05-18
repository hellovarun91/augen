"use client";
import { Button, Input, Label } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { addTesterAction, removeTesterAction } from "../actions";

export function AddTesterForm() {
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={(fd) => {
        setError(null); setInfo(null);
        start(async () => {
          try {
            await addTesterAction(fd);
            setInfo(`Added ${String(fd.get("email"))}.`);
            (document.getElementById("tester-email") as HTMLInputElement | null)?.focus();
            (document.getElementById("tester-form") as HTMLFormElement | null)?.reset();
          } catch (e: any) { setError(e?.message || "Add failed"); }
        });
      }}
      id="tester-form"
      className="grid md:grid-cols-[2fr,3fr,auto] gap-2 items-end"
    >
      <div className="space-y-1">
        <Label>Email</Label>
        <Input id="tester-email" name="email" type="email" required placeholder="tester@example.com" />
      </div>
      <div className="space-y-1">
        <Label>Note (optional)</Label>
        <Input name="note" placeholder="e.g. Brand owner at Tanda" />
      </div>
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
      </div>
      {info && <div className="md:col-span-3 text-xs text-emerald-300">{info}</div>}
      {error && <div className="md:col-span-3 text-xs text-rose-300">{error}</div>}
    </form>
  );
}

export function RemoveTesterButton({ email }: { email: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm(`Remove ${email} from the allowlist?`)) return;
        start(async () => { await removeTesterAction(email); });
      }}
      disabled={pending}
      className="text-[11px] text-ink-400 hover:text-rose-300"
    >
      remove
    </button>
  );
}
