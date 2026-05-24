import Link from "next/link";
import { getChromeContext } from "@/lib/chrome";
import { SidebarNav } from "./sidebar-nav";
import { BrandSwitcher } from "./brand-switcher";
import { isAdmin } from "@/lib/admin";

export async function Sidebar() {
  const { user, brands, contextBrand } = await getChromeContext();
  const admin = isAdmin(user);
  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 self-start sticky top-0 h-screen overflow-y-auto border-r border-white/5 bg-ink-950/70 backdrop-blur-md">
      <Link href="/" className="px-5 py-5 block">
        <div className="flex items-baseline gap-2">
          <span className="serif text-2xl tracking-tight">Augen</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-300">studio</span>
        </div>
      </Link>

      {user && brands.length > 0 && contextBrand && (
        <div className="px-4 pb-3">
          <BrandSwitcher brands={brands} activeBrandId={contextBrand.id} />
        </div>
      )}

      <SidebarNav
        user={user ? { id: user.id, name: user.name, email: user.email, color: user.avatar_color } : null}
        contextBrand={contextBrand ? { id: contextBrand.id, slug: contextBrand.slug, name: contextBrand.name } : null}
        isAdmin={admin}
      />
    </aside>
  );
}
