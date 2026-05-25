"use client";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useTransition } from "react";

interface BrandLite { id: string; slug: string; name: string; tokens: { palette: { primary: string; accent: string } } }

export function BrandSwitcher({ brands, activeBrandId }: { brands: BrandLite[]; activeBrandId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = brands.find((b) => b.id === activeBrandId) || brands[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function choose(b: BrandLite) {
    setOpen(false);
    if (b.id === activeBrandId) return;
    start(async () => {
      await fetch(`/api/active-brand?id=${b.id}`, { method: "POST" });
      router.push(`/brands/${b.slug}`);
      router.refresh();
    });
  }

  const Swatches = ({ b }: { b: BrandLite }) => (
    <span className="flex -space-x-1 shrink-0">
      <span className="w-3 h-3 rounded-full ring-1 ring-ink-950" style={{ background: b.tokens.palette.primary }} />
      <span className="w-3 h-3 rounded-full ring-1 ring-ink-950" style={{ background: b.tokens.palette.accent }} />
    </span>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="w-full flex items-center gap-2 rounded-xl ring-1 ring-white/10 bg-ink-900/60 hover:bg-ink-800 px-3 py-2 text-left transition-colors disabled:opacity-60"
      >
        {active && <Swatches b={active} />}
        <span className="flex-1 min-w-0 text-sm text-ink-100 truncate">{active?.name || "Select brand"}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" className={"text-ink-400 transition-transform " + (open ? "rotate-180" : "")} fill="none">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 rounded-xl ring-1 ring-white/10 bg-ink-800 shadow-2xl overflow-hidden py-1 max-h-72 overflow-y-auto">
          {brands.map((b) => (
            <button
              key={b.id}
              onClick={() => choose(b)}
              className={"w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors " + (b.id === activeBrandId ? "text-white" : "text-ink-200")}
            >
              <Swatches b={b} />
              <span className="flex-1 min-w-0 truncate">{b.name}</span>
              {b.id === activeBrandId && (
                <svg width="13" height="13" viewBox="0 0 13 13" className="text-ink-300 shrink-0" fill="none"><path d="M2.5 6.5L5 9L10.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
