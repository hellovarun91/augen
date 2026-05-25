"use client";
import { Button } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { approveConnectAction } from "./actions";

export function ConnectApprove({ code, email }: { code: string; email: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function approve() {
    setError(null);
    start(async () => {
      const r = await approveConnectAction(code);
      if (r.ok) setDone(true);
      else setError(r.error || "Could not connect.");
    });
  }

  if (done) {
    return (
      <div className="space-y-2 text-center">
        <div className="text-2xl">✓</div>
        <div className="text-ink-100">Connected as <span className="text-white">{email}</span>.</div>
        <div className="text-sm text-ink-400">Return to Figma — your brands are loading there now. You can close this tab.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-ink-200">Connect the <span className="text-white">Figma plugin</span> to your Augen account <span className="text-white">{email}</span>?</p>
      <p className="text-xs text-ink-400">The plugin will be able to read your brands' creatives and write copy/layout edits back — scoped to your account. You can revoke it anytime in Settings → MCP &amp; API.</p>
      <Button size="lg" onClick={approve} disabled={pending} className="w-full">{pending ? "Connecting…" : "Approve & connect"}</Button>
      {error && <div className="text-sm text-rose-300">{error}</div>}
    </div>
  );
}
