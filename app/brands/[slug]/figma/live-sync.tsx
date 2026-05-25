"use client";
import { Badge, Button, Eyebrow, Input } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enableLiveSyncAction, disableLiveSyncAction } from "./actions";

interface Hook { team_id: string; file_key: string; active: number; last_event_at: number | null; last_status: string | null }

export function FigmaLiveSync({ brandId, slug, fileSet, hook }: { brandId: string; slug: string; fileSet: boolean; hook: Hook | null }) {
  const [teamId, setTeamId] = useState(hook?.team_id || "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function enable() {
    setError(null);
    start(async () => {
      try { await enableLiveSyncAction(brandId, slug, teamId); router.refresh(); }
      catch (e: any) { setError(e?.message || "Could not enable live sync"); }
    });
  }
  function disable() {
    setError(null);
    start(async () => {
      try { await disableLiveSyncAction(brandId, slug); router.refresh(); }
      catch (e: any) { setError(e?.message || "Could not disable"); }
    });
  }

  if (hook) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge tone="ok">Live</Badge>
          <span className="text-sm text-ink-200">Watching file <code className="text-ink-300">{hook.file_key}</code> on team <code className="text-ink-300">{hook.team_id}</code>.</span>
        </div>
        <div className="text-xs text-ink-400">
          {hook.last_event_at ? `Last event ${new Date(hook.last_event_at).toLocaleString()} — ${hook.last_status || "ok"}` : "No events yet. Save a change in Figma to test."}
        </div>
        <Button size="sm" variant="ghost" onClick={disable} disabled={pending}>{pending ? "…" : "Turn off live sync"}</Button>
        {error && <div className="text-xs text-rose-300">{error}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Eyebrow>Live sync</Eyebrow>
      <p className="text-sm text-ink-300">
        Let Figma push changes to Augen automatically: when a designer saves Variables in the watched file, we pull and update the brand tokens — no manual “Pull.”
      </p>
      {!fileSet ? (
        <div className="text-sm text-amber-200">Set and pull a Figma file above first, so we know which file to watch.</div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={teamId} onChange={(e) => setTeamId(e.target.value)} placeholder="Figma team ID (the number in your team URL)" className="flex-1" />
            <Button onClick={enable} disabled={pending || !teamId.trim()}>{pending ? "Enabling…" : "Enable live sync"}</Button>
          </div>
          {error && <div className="text-xs text-rose-300">{error}</div>}
          <div className="text-[11px] text-ink-500">
            Requires a public HTTPS URL (works once deployed) and a Figma plan with Variables + webhook access (Enterprise). We store a secret passcode and verify every event.
          </div>
        </>
      )}
    </div>
  );
}
