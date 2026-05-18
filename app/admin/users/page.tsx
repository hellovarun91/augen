import { Badge, Card, Eyebrow, Section } from "@/components/ui/primitives";
import { isAdmin, listUsersWithSummary } from "@/lib/admin";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { user } = await getSession();
  if (!user) redirect("/signin");
  if (!isAdmin(user)) notFound();
  const users = listUsersWithSummary();

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-8">
      <div>
        <Link href="/admin" className="text-xs text-ink-400 hover:text-ink-100">← Admin</Link>
        <h1 className="serif text-display-lg tracking-tight mt-2">Users · {users.length}</h1>
      </div>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="text-xs text-ink-400">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="text-left">Status</th>
              <th className="text-left">Tier</th>
              <th className="text-right">Credits</th>
              <th className="text-right">Used</th>
              <th className="text-right">Brands</th>
              <th className="text-left">Last seen</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: u.avatar_color, color: "#0A0A0B" }}>
                      {u.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="text-ink-100 truncate">{u.name}</div>
                      <div className="text-[11px] text-ink-400 truncate">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td><Badge tone={u.status === "active" ? "ok" : "danger"}>{u.status}</Badge></td>
                <td><Badge>{u.tier}</Badge></td>
                <td className="text-right text-ink-100">{u.credits_balance.toLocaleString()}</td>
                <td className="text-right text-ink-300">{u.lifetime_used.toLocaleString()}</td>
                <td className="text-right text-ink-300">{u.brand_count}</td>
                <td className="text-ink-400 text-xs">{u.last_seen_at ? relativeDate(u.last_seen_at) : "never"}</td>
                <td className="pr-4 text-right">
                  <Link href={`/admin/users/${u.id}`} className="text-xs text-ink-200 hover:text-white">Manage →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
