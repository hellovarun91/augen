import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AppNav } from "@/lib/nav";

// Wayfinding header: breadcrumbs (up) + contextual tabs (sideways).
// Server component — active state is computed from the URL, no client JS.
export function AppHeader({ nav }: { nav: AppNav }) {
  if (!nav.crumbs.length) return null;
  const last = nav.crumbs.length - 1;
  return (
    <div className="md:sticky md:top-0 z-20 bg-ink-950/80 backdrop-blur-md border-b border-white/5">
      <div className="px-4 md:px-8 py-2.5 flex items-center gap-1.5 text-sm overflow-x-auto scrollbar-none">
        {nav.crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
            {i > 0 && <span className="text-ink-600">›</span>}
            {c.href && i !== last ? (
              <Link href={c.href} className="text-ink-300 hover:text-ink-50 transition-colors">{c.label}</Link>
            ) : (
              <span className="text-ink-100">{c.label}</span>
            )}
          </span>
        ))}
      </div>
      {nav.tabs && nav.tabs.length > 0 && (
        <div className="px-4 md:px-8 flex items-center gap-1 overflow-x-auto scrollbar-none border-t border-white/5">
          {nav.tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
                t.active ? "border-ink-50 text-ink-50 font-medium" : "border-transparent text-ink-500 hover:text-ink-200",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
