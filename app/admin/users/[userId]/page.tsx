import { Badge, Card, Eyebrow, Section } from "@/components/ui/primitives";
import { getUserWithSummary, isAdmin, listAdminLog, userBrands } from "@/lib/admin";
import { listFeatureFlags, listUserOverrides } from "@/lib/features";
import { listCreditTxns } from "@/lib/credits";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";
import { UserActions, FlagOverrideControls } from "./controls";

export const dynamic = "force-dynamic";

export default async function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { user } = await getSession();
  if (!user) redirect("/signin");
  if (!isAdmin(user)) notFound();
  const { userId } = await params;
  const summary = getUserWithSummary(userId);
  if (!summary) notFound();

  const brands = userBrands(userId);
  const overrides = listUserOverrides(userId);
  const overrideMap = new Map(overrides.map((o) => [o.flag_name, o.enabled === 1]));
  const flags = listFeatureFlags();
  const txns = listCreditTxns(userId, 20);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-6xl mx-auto space-y-8">
      <div>
        <Link href="/admin/users" className="text-xs text-ink-400 hover:text-ink-100">← Users</Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full flex items-center justify-center text-base font-semibold" style={{ background: summary.avatar_color, color: "#0A0A0B" }}>
              {summary.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h1 className="serif text-display-lg tracking-tight">{summary.name}</h1>
              <div className="text-ink-300 text-sm">{summary.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={summary.status === "active" ? "ok" : "danger"}>{summary.status}</Badge>
            <Badge>{summary.tier}</Badge>
          </div>
        </div>
      </div>

      <Section title="Account">
        <UserActions userId={userId} status={summary.status as "active" | "disabled"} tier={summary.tier as any} balance={summary.credits_balance} />
      </Section>

      <Section title="Brand memberships" subtitle={`${brands.length} brand${brands.length === 1 ? "" : "s"}`}>
        {brands.length === 0 ? (
          <Card className="p-5 text-sm text-ink-300">No brand memberships.</Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {brands.map((b) => (
              <Card key={b.brand_id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="serif text-base">{b.brand_name}</div>
                  <div className="text-[11px] text-ink-400">{b.brand_slug}</div>
                </div>
                <Badge tone={b.role === "owner" ? "ok" : "neutral"}>{b.role}</Badge>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="Feature flag overrides" subtitle="Per-user overrides take precedence over the global flag. Inherit = follow the global setting.">
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="text-xs text-ink-400">
              <tr>
                <th className="px-4 py-3 text-left">Flag</th>
                <th>Description</th>
                <th>Global</th>
                <th>Override for this user</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.name} className="border-t border-white/5">
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-200">{f.name}</td>
                  <td className="text-ink-300 text-xs">{f.description}</td>
                  <td><Badge tone={f.enabled_globally ? "ok" : "neutral"}>{f.enabled_globally ? "on" : "off"}</Badge></td>
                  <td>
                    <FlagOverrideControls flagName={f.name} userId={userId} current={overrideMap.get(f.name)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Credit transactions">
        {txns.length === 0 ? (
          <Card className="p-5 text-sm text-ink-300">No transactions.</Card>
        ) : (
          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="text-xs text-ink-400">
                <tr>
                  <th className="px-4 py-3 text-left">When</th>
                  <th>Kind</th>
                  <th>Description</th>
                  <th className="text-right pr-4">Amount</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-ink-300">{relativeDate(t.created_at)}</td>
                    <td><Badge tone={t.kind === "charge" ? "danger" : t.kind === "grant" ? "ok" : "info"}>{t.kind}</Badge></td>
                    <td className="text-ink-200">{t.description}</td>
                    <td className={"text-right pr-4 " + (t.amount < 0 ? "text-rose-200" : "text-emerald-200")}>{t.amount > 0 ? "+" : ""}{t.amount}</td>
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
