import Link from "next/link";
import { getSession } from "@/lib/session";
import { SidebarNav } from "./sidebar-nav";
import { BrandSwitcher } from "./brand-switcher";
import { UsageChip } from "./usage-chip";

export async function Sidebar() {
  const { user, brands, activeBrand } = await getSession();
  return (
    <aside className="hidden md:flex md:flex-col w-64 border-r border-white/5 bg-ink-950/70 backdrop-blur-md min-h-screen sticky top-0">
      <Link href="/" className="px-5 py-5 block">
        <div className="flex items-baseline gap-2">
          <span className="serif text-2xl tracking-tight">Augen</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-300">studio</span>
        </div>
      </Link>

      {user && brands.length > 0 && (
        <div className="px-4 pb-3">
          <BrandSwitcher brands={brands} activeBrandId={activeBrand?.id || ""} />
        </div>
      )}

      <SidebarNav user={user ? { id: user.id, name: user.name, email: user.email, color: user.avatar_color } : null} activeBrand={activeBrand ? { id: activeBrand.id, slug: activeBrand.slug, name: activeBrand.name } : null} />

      {user && (
        <div className="px-4 pb-3">
          <UsageChip />
        </div>
      )}
    </aside>
  );
}
