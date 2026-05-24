"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/signin/actions";

export function MobileNav({
  user,
  brands,
  activeBrand,
  isAdmin = false,
}: {
  user: { id: string; name: string; email: string; color: string } | null;
  brands: Array<{ id: string; slug: string; name: string; tokens: { palette: { primary: string; accent: string } } }>;
  activeBrand: { id: string; slug: string; name: string } | null;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname() || "/";
  const router = useRouter();

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [path]);

  // Body scroll lock when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const manageNav = activeBrand
    ? [
        { href: `/brands/${activeBrand.slug}`, label: "Overview" },
        { href: `/brands/${activeBrand.slug}/language`, label: "Language" },
        { href: `/brands/${activeBrand.slug}/tokens`, label: "Design tokens" },
        { href: `/brands/${activeBrand.slug}/tokens/extract`, label: "Extract from artwork" },
        { href: `/brands/${activeBrand.slug}/figma`, label: "Figma sync" },
        { href: `/brands/${activeBrand.slug}/references`, label: "References" },
        { href: `/brands/${activeBrand.slug}/winners`, label: "Winners" },
      ]
    : [];

  const studioNav = activeBrand
    ? [
        { href: `/brands/${activeBrand.slug}/plan`, label: "Plan a quarter" },
        { href: "/campaigns", label: "Projects" },
        { href: "/review", label: "Review" },
      ]
    : [];

  const settingsNav = [
    { href: "/formats", label: "Format catalog" },
    { href: "/providers", label: "AI providers" },
  ];

  async function switchBrand(brandId: string) {
    await fetch(`/api/active-brand?id=${brandId}`, { method: "POST" });
    const next = brands.find((b) => b.id === brandId);
    if (next) router.push(`/brands/${next.slug}`);
    router.refresh();
    setOpen(false);
  }

  return (
    <>
      {/* Top bar — shown only on mobile */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-3 bg-ink-950/90 backdrop-blur-md border-b border-white/5 px-4 h-14">
        <Link href="/" className="flex items-baseline gap-1.5" onClick={() => setOpen(false)}>
          <span className="serif text-xl tracking-tight">Augen</span>
          {activeBrand && (
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400 truncate max-w-[120px]">· {activeBrand.name}</span>
          )}
        </Link>
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 ring-1 ring-white/10 hover:bg-white/5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* Drawer overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative ml-auto h-full w-[86%] max-w-xs bg-ink-950 border-l border-white/5 overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-14 border-b border-white/5">
              <div className="flex items-baseline gap-2">
                <span className="serif text-xl tracking-tight">Augen</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-ink-300">studio</span>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 ring-1 ring-white/10 hover:bg-white/5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Brand switcher */}
            {brands.length > 0 && (
              <div className="px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-1.5">Workspace</div>
                <select
                  value={activeBrand?.id || ""}
                  onChange={(e) => switchBrand(e.target.value)}
                  className="w-full rounded-xl bg-ink-900 ring-1 ring-white/10 px-3 py-2 text-sm text-ink-100"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {activeBrand ? (
              <>
                <div className="px-4 pt-2">
                  <Link href="/" className="text-[11px] text-ink-400">← All brands</Link>
                </div>
                <NavSection label="Manage Brand">
                  {manageNav.map((n) => <DrawerItem key={n.href} {...n} active={path === n.href || (n.href !== `/brands/${activeBrand.slug}` && path.startsWith(n.href))} />)}
                </NavSection>
                <NavSection label="Studio">
                  {studioNav.map((n) => <DrawerItem key={n.href} {...n} active={path === n.href || path.startsWith(n.href + "/")} />)}
                </NavSection>
              </>
            ) : (
              <div className="px-4 py-3">
                <p className="text-xs text-ink-400 leading-relaxed">Pick a brand to manage it and open its Studio.</p>
              </div>
            )}

            <NavSection label="Settings">
              {settingsNav.map((n) => <DrawerItem key={n.href} {...n} active={path === n.href} />)}
            </NavSection>

            {isAdmin && (
              <NavSection label="Admin">
                <DrawerItem href="/admin" label="Overview" active={path === "/admin"} />
                <DrawerItem href="/admin/costs" label="Cost dashboard" active={path === "/admin/costs"} />
                <DrawerItem href="/admin/testers" label="Testers" active={path === "/admin/testers"} />
                <DrawerItem href="/admin/users" label="Users" active={path.startsWith("/admin/users")} />
                <DrawerItem href="/admin/features" label="Feature flags" active={path === "/admin/features"} />
                <DrawerItem href="/usage" label="Token detail" active={path === "/usage"} />
              </NavSection>
            )}

            <div className="mt-auto px-4 py-4 border-t border-white/5">
              {user ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: user.color, color: "#0A0A0B" }}>
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
          </aside>
        </div>
      )}
    </>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2">
      <div className="px-3 text-[10px] uppercase tracking-[0.18em] text-ink-400 mb-1.5">{label}</div>
      <nav className="space-y-0.5">{children}</nav>
    </div>
  );
}

function DrawerItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl px-3 py-2 text-sm transition-colors",
        active ? "bg-white/5 text-ink-50" : "text-ink-300 hover:bg-white/[0.03] hover:text-ink-100",
      )}
    >
      {label}
    </Link>
  );
}
