"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function BrandSwitcher({
  brands,
  activeBrandId,
}: {
  brands: Array<{ id: string; slug: string; name: string; tokens: { palette: { primary: string; accent: string } } }>;
  activeBrandId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = brands.find((b) => b.id === activeBrandId) || brands[0];

  function onChange(brandId: string) {
    start(async () => {
      await fetch(`/api/active-brand?id=${brandId}`, { method: "POST" });
      router.refresh();
      const next = brands.find((b) => b.id === brandId);
      if (next) router.push(`/brands/${next.slug}`);
    });
  }

  return (
    <div className="rounded-xl ring-1 ring-white/10 bg-ink-900/60">
      <select
        value={activeBrandId}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="w-full bg-transparent px-3 py-2 text-sm text-ink-100 rounded-xl appearance-none focus:outline-none cursor-pointer"
      >
        {brands.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
      <div className="px-3 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: active?.tokens.palette.primary }} />
          <span className="w-2 h-2 rounded-full" style={{ background: active?.tokens.palette.accent }} />
          <span className="text-[10px] text-ink-400">workspace</span>
        </div>
      </div>
    </div>
  );
}
