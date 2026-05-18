import { Badge, Card, Empty, Eyebrow, Section } from "@/components/ui/primitives";
import { isAdmin } from "@/lib/admin";
import { envAllowlist, listAllowedEmails } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { getUserByEmail } from "@/lib/users";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";
import { AddTesterForm, RemoveTesterButton } from "./controls";

export const dynamic = "force-dynamic";

export default async function TestersPage() {
  const { user } = await getSession();
  if (!user) redirect("/signin");
  if (!isAdmin(user)) notFound();

  const allowed = listAllowedEmails();
  const env = envAllowlist();
  const dbActive = allowed.length > 0;

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-5xl mx-auto space-y-8">
      <div>
        <Link href="/admin" className="text-xs text-ink-400 hover:text-ink-100">← Admin</Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2">
          <div>
            <h1 className="serif text-display-lg tracking-tight">Testers</h1>
            <p className="text-ink-300 mt-2 max-w-2xl">
              Sign-in is gated to this list. Add an email here and that person can sign in. Remove an email and their next sign-in fails.
              <span className="text-ink-400"> Existing sessions are not signed out — to lock someone out instantly, disable their user account from Users.</span>
            </p>
          </div>
          <Badge tone={dbActive ? "ok" : env.length ? "info" : "warn"}>
            {dbActive ? `${allowed.length} allowed (db)` : env.length ? `${env.length} allowed (env fallback)` : "open — no allowlist"}
          </Badge>
        </div>
      </div>

      {!dbActive && env.length > 0 && (
        <Card className="p-5 ring-amber-500/20">
          <Eyebrow>Env-var fallback active</Eyebrow>
          <p className="text-sm text-ink-300 mt-2">
            The DB-managed allowlist is empty, so Augen is falling back to the <code className="text-ink-100">AUGEN_ALLOWED_EMAILS</code> env var.
            Currently: <span className="text-ink-200">{env.join(", ")}</span>
          </p>
          <p className="text-sm text-ink-300 mt-2">
            Add any email below — that switches Augen to DB mode and the env var stops mattering.
          </p>
        </Card>
      )}

      <Card className="p-6 space-y-3">
        <Eyebrow>Add a tester</Eyebrow>
        <AddTesterForm />
      </Card>

      <Section title={`${allowed.length} allowed`} subtitle="Sorted newest first.">
        {allowed.length === 0 ? (
          <Empty title="No testers yet">Add an email above to start the closed beta.</Empty>
        ) : (
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-400">
                <tr>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Note</th>
                  <th className="text-left">Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {allowed.map((row) => {
                  const u = getUserByEmail(row.email);
                  return (
                    <tr key={row.email} className="border-t border-white/5">
                      <td className="px-4 py-3 text-ink-100">{row.email}</td>
                      <td>
                        {u ? (
                          <Badge tone={(u as any).status === "active" ? "ok" : "danger"}>{(u as any).status === "active" ? "signed in" : "disabled"}</Badge>
                        ) : (
                          <Badge>not signed in yet</Badge>
                        )}
                      </td>
                      <td className="text-ink-300 text-xs">{row.note || "—"}</td>
                      <td className="text-ink-400 text-xs">{relativeDate(row.added_at)}</td>
                      <td className="pr-4 text-right">
                        <RemoveTesterButton email={row.email} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </Section>
    </div>
  );
}
