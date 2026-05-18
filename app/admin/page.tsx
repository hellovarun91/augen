import { Badge, Card, Eyebrow, LinkButton, Section, Stat } from "@/components/ui/primitives";
import { adminStats, isAdmin, listAdminLog } from "@/lib/admin";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import { relativeDate } from "@/lib/utils";
import { formatUsd } from "@/lib/agents/pricing";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const { user } = await getSession();
  if (!user) redirect("/signin");
  if (!isAdmin(user)) notFound();

  const stats = adminStats();
  const log = listAdminLog(12);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-10">
      <div>
        <Eyebrow>Admin</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Operator view.</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Studio-wide stats, users, and feature flags. Visible to emails in <code className="text-ink-200">AUGEN_ADMIN_EMAILS</code>.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-5"><Stat label="Users" value={stats.users.total} sub={`${stats.users.active} active · ${stats.users.signed_in_last_7d} active in 7d`} /></Card>
        <Card className="p-5"><Stat label="Brands" value={stats.brands} sub={`${stats.campaigns} campaigns`} /></Card>
        <Card className="p-5"><Stat label="Ads" value={stats.generations.total} sub={`${stats.generations.pending} pending · ${stats.generations.approved} approved`} /></Card>
        <Card className="p-5"><Stat label="AI cost (30d)" value={formatUsd(stats.agent_runs.cost_micros)} sub={`${stats.agent_runs.claude} real · ${stats.agent_runs.mock} mock`} /></Card>
      </div>

      <Section title="Quick links">
        <div className="grid md:grid-cols-3 gap-3">
          <LinkButton href="/admin/users" variant="ghost">Users →</LinkButton>
          <LinkButton href="/admin/features" variant="ghost">Feature flags →</LinkButton>
          <LinkButton href="/usage" variant="ghost">Token usage report →</LinkButton>
        </div>
      </Section>

      <Section title="Recent admin actions" subtitle="Every grant, tier change, disable, or flag toggle gets recorded here.">
        {log.length === 0 ? (
          <Card className="p-5"><div className="text-sm text-ink-300">No admin actions yet.</div></Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-400">
                <tr><th className="px-4 py-3 text-left">When</th><th>Action</th><th>Target</th><th>Payload</th></tr>
              </thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-ink-300">{relativeDate(l.created_at)}</td>
                    <td><Badge tone="info">{l.action}</Badge></td>
                    <td className="text-ink-200 text-xs">{l.target_user_id || l.target_brand_id || "—"}</td>
                    <td className="text-ink-400 text-[11px] font-mono line-clamp-1 max-w-md">{l.payload_json || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>
    </div>
  );
}
