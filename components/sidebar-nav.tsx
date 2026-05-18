"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/signin/actions";

export function SidebarNav({
  user,
  activeBrand,
  isAdmin = false,
}: {
  user: { id: string; name: string; email: string; color: string } | null;
  activeBrand: { id: string; slug: string; name: string } | null;
  isAdmin?: boolean;
}) {
  const path = usePathname() || "/";

  const brandNav = activeBrand
    ? [
        { href: `/brands/${activeBrand.slug}`, label: "Overview", group: "brand" },
        { href: `/brands/${activeBrand.slug}/language`, label: "Language", group: "brand" },
        { href: `/brands/${activeBrand.slug}/tokens`, label: "Design tokens", group: "brand" },
        { href: `/brands/${activeBrand.slug}/tokens/extract`, label: "Extract from artwork", group: "brand" },
        { href: `/brands/${activeBrand.slug}/figma`, label: "Figma sync", group: "brand" },
        { href: `/brands/${activeBrand.slug}/references`, label: "References", group: "brand" },
        { href: `/brands/${activeBrand.slug}/winners`, label: "Winners (learning)", group: "brand" },
        { href: `/brands/${activeBrand.slug}/plan`, label: "Quarterly plan", group: "brand" },
      ]
    : [];

  const studioNav = [
    { href: "/", label: "Dashboard" },
    { href: "/campaigns", label: "Campaigns" },
    { href: "/review", label: "Review queue" },
    { href: "/formats", label: "Format catalog" },
    { href: "/credits", label: "Credits & plan" },
    { href: "/providers", label: "AI providers" },
    { href: "/usage", label: "Token usage (ops)" },
  ];

  const launchNav = [
    { href: "/launch", label: "Launch (run ads)", note: "optional · budget lives here" },
  ];

  return (
    <div className="flex-1 flex flex-col">
      {activeBrand && (
        <Section label={activeBrand.name}>
          {brandNav.map((n) => (
            <NavItem key={n.href} href={n.href} label={n.label} active={path === n.href || path.startsWith(n.href + "/")} />
          ))}
        </Section>
      )}

      <Section label="Studio">
        {studioNav.map((n) => (
          <NavItem key={n.href} href={n.href} label={n.label} active={path === n.href} />
        ))}
      </Section>

      <Section label="Launch">
        {launchNav.map((n) => (
          <NavItem key={n.href} href={n.href} label={n.label} note={n.note} active={path === n.href} />
        ))}
      </Section>

      {isAdmin && (
        <Section label="Admin">
          <NavItem href="/admin" label="Overview" active={path === "/admin"} />
          <NavItem href="/admin/users" label="Users" active={path.startsWith("/admin/users")} />
          <NavItem href="/admin/features" label="Feature flags" active={path === "/admin/features"} />
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

function NavItem({ href, label, active, note }: { href: string; label: string; active: boolean; note?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl px-3 py-1.5 text-sm transition-colors",
        active ? "bg-white/5 text-ink-50" : "text-ink-300 hover:bg-white/[0.03] hover:text-ink-100",
      )}
    >
      <div>{label}</div>
      {note && <div className="text-[10px] text-ink-500">{note}</div>}
    </Link>
  );
}
