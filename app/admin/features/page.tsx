import { Badge, Card, Eyebrow, Section } from "@/components/ui/primitives";
import { isAdmin } from "@/lib/admin";
import { listFeatureFlags } from "@/lib/features";
import { getSession } from "@/lib/session";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { FlagGlobalControls } from "./controls";

export const dynamic = "force-dynamic";

export default async function AdminFeaturesPage() {
  const { user } = await getSession();
  if (!user) redirect("/signin");
  if (!isAdmin(user)) notFound();
  const flags = listFeatureFlags();

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-5xl mx-auto space-y-8">
      <div>
        <Link href="/admin" className="text-xs text-ink-400 hover:text-ink-100">← Admin</Link>
        <h1 className="serif text-display-lg tracking-tight mt-2">Feature flags</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          Global on/off per feature. Per-user overrides live on each user's detail page.
          Use these for gradual rollouts and kill-switches.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-400">
            <tr>
              <th className="px-4 py-3 text-left">Flag</th>
              <th>Description</th>
              <th className="text-right pr-4">Global</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.name} className="border-t border-white/5">
                <td className="px-4 py-3 font-mono text-xs text-ink-100">{f.name}</td>
                <td className="text-ink-300 text-xs">{f.description}</td>
                <td className="text-right pr-4"><FlagGlobalControls name={f.name} enabled={f.enabled_globally === 1} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
