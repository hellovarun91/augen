"use client";
import { Badge, Button, Card, Eyebrow, Input } from "@/components/ui/primitives";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMemberAction, changeRoleAction, removeMemberAction } from "./actions";
import { TEAM_ROLES, roleLabel as ROLE_LABEL } from "@/lib/roles";

interface Member { id: string; role: string; name: string; email: string; color: string; isSelf: boolean }

export function TeamManager({ brandId, members }: { brandId: string; members: Member[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("copywriter");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function invite() {
    setError(null); setNote(null);
    start(async () => {
      try { await inviteMemberAction(brandId, email, role); setNote(`Invited ${email.trim()}`); setEmail(""); router.refresh(); }
      catch (e: any) { setError(e?.message || "Could not invite"); }
    });
  }
  function act(fn: () => Promise<void>) {
    setError(null);
    start(async () => { try { await fn(); router.refresh(); } catch (e: any) { setError(e?.message || "Failed"); } });
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-3">
        <Eyebrow>Invite a teammate</Eyebrow>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") invite(); }} placeholder="name@company.com" className="flex-1" type="email" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg bg-ink-800 px-3 py-2 text-sm text-ink-50 ring-1 ring-inset ring-white/10">
            {TEAM_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL(r)}</option>)}
          </select>
          <Button onClick={invite} disabled={pending || !email.trim()}>{pending ? "Inviting…" : "Invite"}</Button>
        </div>
        <div className="text-[11px] text-ink-400">They'll be able to sign in with this email and land in this brand. Roles guide who does what — everyone on the team can edit during the beta.</div>
        {note && <div className="text-xs text-emerald-300">{note}</div>}
        {error && <div className="text-xs text-rose-300">{error}</div>}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5"><Eyebrow>Members — {members.length}</Eyebrow></div>
        <ul>
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-b-0">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: m.color, color: "#0A0A0B" }}>
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink-100 truncate">{m.name}{m.isSelf && <span className="text-ink-500"> · you</span>}</div>
                <div className="text-[11px] text-ink-400 truncate">{m.email}</div>
              </div>
              {m.role === "owner" ? (
                <Badge tone="ok">Owner</Badge>
              ) : (
                <>
                  <select value={TEAM_ROLES.includes(m.role as any) ? m.role : "copywriter"} onChange={(e) => act(() => changeRoleAction(brandId, m.id, e.target.value))} disabled={pending}
                    className="rounded-lg bg-ink-800 px-2.5 py-1.5 text-xs text-ink-100 ring-1 ring-inset ring-white/10">
                    {TEAM_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL(r)}</option>)}
                  </select>
                  <button onClick={() => { if (confirm(`Remove ${m.name} from this brand?`)) act(() => removeMemberAction(brandId, m.id)); }} disabled={pending} className="text-[11px] text-ink-400 hover:text-rose-300 shrink-0">Remove</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
