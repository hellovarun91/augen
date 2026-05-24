import Link from "next/link";
import { cn } from "@/lib/utils";

// Sub-navigation for the Design Tokens area — the editor and its two companion
// tools (artwork extraction, Figma sync) read as one place, with a clear
// "you are here". Rendered at the top of each of the three token pages.
const TABS = [
  { key: "editor", label: "Editor", seg: "tokens" },
  { key: "extract", label: "Extract from artwork", seg: "tokens/extract" },
  { key: "figma", label: "Figma sync", seg: "figma" },
] as const;

export function TokenSubNav({ slug, active }: { slug: string; active: "editor" | "extract" | "figma" }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-white/5">
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`/brands/${slug}/${t.seg}`}
          className={cn(
            "px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
            active === t.key ? "border-ink-50 text-ink-50 font-medium" : "border-transparent text-ink-500 hover:text-ink-200",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
