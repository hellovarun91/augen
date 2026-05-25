import { Card, Eyebrow, Section } from "@/components/ui/primitives";
import { getSession } from "@/lib/session";
import { listApiTokens } from "@/lib/repo";
import { TOOL_DEFS } from "@/lib/mcp/tools";
import { McpManager } from "./manager";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function McpPage() {
  const { user } = await getSession();
  if (!user) redirect("/signin");

  const tokens = listApiTokens(user.id).map((t) => ({ id: t.id, name: t.name, created_at: t.created_at, last_used_at: t.last_used_at }));

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/mcp`;

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-4xl mx-auto space-y-8">
      <div>
        <Eyebrow>Settings · MCP</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Control Augen from Claude</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Connect Claude Desktop or Claude Code to Augen over MCP. Once connected, you can drive the studio in plain
          language — “create a brand from this brief, draft three launch projects, generate ads for the launch one, and
          show me anything under 70% confidence.” Everything stays scoped to your brands.
        </p>
      </div>

      <McpManager tokens={tokens} endpoint={endpoint} />

      <Section title="Available tools" subtitle="What Claude can do once connected.">
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-white/5">
            {TOOL_DEFS.map((t) => (
              <li key={t.name} className="px-5 py-3">
                <code className="text-sm text-ink-100">{t.name}</code>
                <div className="text-xs text-ink-400 mt-0.5">{t.description}</div>
              </li>
            ))}
          </ul>
        </Card>
        <p className="text-[11px] text-ink-500 mt-3">
          Read + safe-write only — no destructive operations. <code className="text-ink-300">generate_ads</code> incurs real
          AI/image spend and is rate-limited. Tokens are revocable any time above.
        </p>
      </Section>

      <Section title="Figma plugin" subtitle="Edit creatives in Figma and sync them back — one-click connect, no token to paste.">
        <Card className="p-6 space-y-3 text-sm text-ink-200">
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>In Figma (desktop): <b>Plugins → Development → Import plugin from manifest…</b> and pick <code className="text-ink-300">figma-plugin/manifest.json</code> from the repo.</li>
            <li>Open the plugin and click <b>Connect Augen account</b> → a tab opens here → <b>Approve</b>. The plugin connects automatically (it mints a "Figma plugin" token you'll see listed above).</li>
            <li>Pick a <b>brand</b> from the dropdown → <b>Load creatives → Import</b> one. Edit the <code className="text-ink-300">augen:*</code> text layers (and move the headline / CTA), select the frame, then <b>Send selection → Augen</b>.</li>
            <li>Copy <i>and</i> layout (headline position, CTA placement) sync back. Re-render the creative in Augen to see the changes.</li>
          </ol>
          <p className="text-[11px] text-ink-500">No URL/token/slug to type — the render imports as a locked backdrop and you edit the text layers on top. Revoke access by deleting its token above.</p>
        </Card>
      </Section>
    </div>
  );
}
