"use client";
import { useTransition } from "react";
import { setFlagGlobalAction } from "../actions";

export function FlagGlobalControls({ name, enabled }: { name: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => { await setFlagGlobalAction(name, !enabled); })}
      disabled={pending}
      className={
        "text-[11px] rounded-full px-3 py-1 ring-1 transition-colors " +
        (enabled
          ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
          : "bg-ink-800 text-ink-300 ring-white/10")
      }
    >
      {enabled ? "ON" : "OFF"}
    </button>
  );
}
