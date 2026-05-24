"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/signin/actions";

export function SidebarNav({
  user,
  contextBrand,
  isAdmin = false,
}: {
  user: { id: string; name: string; email: string; color: string } | null;
  contextBrand: { id: string; slug: string; name: string } | null;
  isAdmin?: boolean;
}) {
  const path = usePathname() || "/";
  const [settingsOpen, setSettingsOpen] = useState(false);

  const b = contextBrand?.slug;
  const onTokens = !!b && (path.startsWith(`/brands/${b}/tokens`) || path.startsWith(`/brands/${b}/figma`));

  return (
    <div className="flex-1 flex flex-col">
      {contextBrand ? (
        <>
          <div className="px-4 pt-1 pb-2">
            <Link href="/" className="text-[11px] text-ink-400 hover:text-ink-100 transition-colors">← All brands</Link>
          </div>

          <Section label="Manage Brand">
            <NavItem href={`/brands/${b}`} label="Overview" active={path === `/brands/${b}`} />
            <NavItem href={`/brands/${b}/identity`} label="Identity" active={path.startsWith(`/brands/${b}/identity`)} />
            <NavItem href={`/brands/${b}/language`} label="Language" active={path.startsWith(`/brands/${b}/language`)} />
            <NavItem href={`/brands/${b}/tokens`} label="Design tokens" active={path === `/brands/${b}/tokens`} />
            {onTokens && (
              <>
                <NavItem href={`/brands/${b}/tokens/extract`} label="Extract from artwork" active={path.startsWith(`/brands/${b}/tokens/extract`)} sub />
                <NavItem href={`/brands/${b}/figma`} label="Figma sync" active={path.startsWith(`/brands/${b}/figma`)} sub />
              </>
            )}
            <NavItem href={`/brands/${b}/references`} label="References" active={path.startsWith(`/brands/${b}/references`)} />
            <NavItem href={`/brands/${b}/winners`} label="Winners" active={path.startsWith(`/brands/${b}/winners`)} />
          </Section>

          <Section label="Studio">
            <NavItem href={`/brands/${b}/plan`} label="Plan a quarter" active={path.startsWith(`/brands/${b}/plan`)} />
            <NavItem href="/campaigns" label="Projects" active={path === "/campaigns" || path.startsWith("/campaigns/")} />
            <NavItem href="/review" label="Review" active={path.startsWith("/review")} />
          </Section>
        </>
      ) : (
        <div className="px-4 py-3">
          <p className="text-xs text-ink-400 leading-relaxed">Pick a brand to manage it and open its Studio.</p>
        </div>
      )}

      {/* Settings — tucked away, collapsed by default */}
      <div className="px-3 py-2 mt-1">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 text-[10px] uppercase tracking-[0.18em] text-ink-400 hover:text-ink-200 transition-colors"
        >
          <span>Settings</span>
          <span className={cn("transition-transform", settingsOpen && "rotate-90")}>›</span>
        </button>
        {settingsOpen && (
          <nav className="space-y-0.5 mt-1.5">
            <NavItem href="/formats" label="Format catalog" active={path === "/formats"} />
            <NavItem href="/providers" label="AI providers" active={path === "/providers"} />
          </nav>
        )}
      </div>

      {isAdmin && (
        <Section label="Admin">
          <NavItem href="/admin" label="Overview" active={path === "/admin"} />
          <NavItem href="/admin/costs" label="Cost dashboard" active={path === "/admin/costs"} />
          <NavItem href="/admin/testers" label="Testers" active={path === "/admin/testers"} />
          <NavItem href="/admin/users" label="Users" active={path.startsWith("/admin/users")} />
          <NavItem href="/admin/features" label="Feature flags" active={path === "/admin/features"} />
          <NavItem href="/usage" label="Token detail" active={path === "/usage"} />
        </Section>
      )}

      <div className="mt-auto p-4 border-t border-white/5">
        {user ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: user.color, color: "#0A0A0B" }}>
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-xs text-ink-100 truncate">{user.name}</div>
                <div className="text-[10px] text-ink-400 truncate">{user.email}</div>
              </div>
            </div>
            <form action={signOutAction}>
              <button className="text-[11px] text-ink-400 hover:text-ink-100">Sign out</button>
            </form>
          </div>
        ) : (
          <Link href="/signin" className="text-xs text-ink-200 hover:text-white">Sign in →</Link>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2">
      <div className="px-3 text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-1.5">{label}</div>
      <nav className="space-y-0.5">{children}</nav>
    </div>
  );
}

function NavItem({ href, label, active, sub }: { href: string; label: string; active: boolean; sub?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl py-1.5 text-sm transition-colors",
        sub ? "pl-6 pr-3 text-[13px]" : "px-3",
        active ? "bg-white/5 text-ink-50" : "text-ink-300 hover:bg-white/[0.03] hover:text-ink-100",
      )}
    >
      {label}
    </Link>
  );
}
