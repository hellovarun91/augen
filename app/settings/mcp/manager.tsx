"use client";
import { Badge, Button, Card, Eyebrow, Input } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { relativeDate } from "@/lib/utils";
import { createTokenAction, revokeTokenAction } from "./actions";

interface TokenRow { id: string; name: string; created_at: number; last_used_at: number | null }

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="text-[11px] text-ink-400 hover:text-ink-100"
        >{copied ? "copied ✓" : "copy"}</button>
      </div>
      <pre className="text-[11px] text-ink-200 bg-ink-900/70 ring-1 ring-white/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{value}</pre>
    </div>
  );
}

export function McpManager({ tokens, endpoint }: { tokens: TokenRow[]; endpoint: string }) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ token: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const sample = created?.token || "YOUR_TOKEN";
  const codeCmd = `claude mcp add --transport http augen ${endpoint} --header "Authorization: Bearer ${sample}"`;
  const desktopJson = JSON.stringify({
    mcpServers: { augen: { command: "npx", args: ["mcp-remote", endpoint, "--header", `Authorization: Bearer ${sample}`] } },
  }, null, 2);

  function create() {
    setError(null);
    start(async () => {
      try { const r = await createTokenAction(name); setCreated({ token: r.token, name: r.name }); setName(""); router.refresh(); }
      catch (e: any) { setError(e?.message || "Could not create token"); }
    });
  }
  function revoke(id: string) {
    if (!confirm("Revoke this token? Anything using it loses access immediately.")) return;
    start(async () => { try { await revokeTokenAction(id); router.refresh(); } catch (e: any) { setError(e?.message || "Failed"); } });
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <Eyebrow>Personal tokens</Eyebrow>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }} placeholder="Token name (e.g. My laptop · Claude Desktop)" className="flex-1" />
          <Button onClick={create} disabled={pending}>{pending ? "Creating…" : "Generate token"}</Button>
        </div>
        {error && <div className="text-xs text-rose-300">{error}</div>}

        {created && (
          <div className="rounded-lg ring-1 ring-emerald-400/30 bg-emerald-400/[0.06] p-3 space-y-2">
            <div className="text-xs text-emerald-200">Copy this now — you won't be able to see it again.</div>
            <CopyBlock label={`Token · ${created.name}`} value={created.token} />
          </div>
        )}

        {tokens.length > 0 ? (
          <ul className="divide-y divide-white/5">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-100 truncate">{t.name}</div>
                  <div className="text-[11px] text-ink-500">Created {relativeDate(t.created_at)} · {t.last_used_at ? `last used ${relativeDate(t.last_used_at)}` : "never used"}</div>
                </div>
                <button onClick={() => revoke(t.id)} disabled={pending} className="text-[11px] text-ink-400 hover:text-rose-300 shrink-0">Revoke</button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-ink-400">No tokens yet. Generate one to connect Claude.</div>
        )}
      </Card>

      <Card className="p-6 space-y-5">
        <div>
          <Eyebrow>Connect Claude</Eyebrow>
          <p className="text-sm text-ink-300 mt-1">Generate a token above, then drop it into one of these. The token replaces <code className="text-ink-200">YOUR_TOKEN</code>.</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Badge tone="info">Claude Code</Badge><span className="text-xs text-ink-400">run in your terminal</span></div>
          <CopyBlock label="command" value={codeCmd} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Badge tone="info">Claude Desktop</Badge><span className="text-xs text-ink-400">add to claude_desktop_config.json, then restart</span></div>
          <CopyBlock label="config" value={desktopJson} />
        </div>
        <div className="text-[11px] text-ink-500">Endpoint: <code className="text-ink-300">{endpoint}</code> — bearer-token auth, scoped to your brands. Claude Desktop bridges HTTP via <code className="text-ink-300">mcp-remote</code>.</div>
      </Card>
    </div>
  );
}
