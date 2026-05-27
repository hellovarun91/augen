import Link from "next/link";

export type JourneyStep = "overview" | "ideate" | "copy" | "design" | "deliverables";

interface Progress { ideas: number; rows: number; designs: number; ready: number }

// The guided project flow (#50): Overview → Ideate → Copy → Design → Deliverables.
// Not a flat menu — a stepper that shows the order, where you are, and how far the
// work has come. ("Review" lives inside Design: you approve designs where you see them.)
export function JourneyNav({ campaignId, current, progress }: { campaignId: string; current: JourneyStep; progress: Progress }) {
  const steps: { key: JourneyStep; label: string; href: string; done: boolean; count?: number }[] = [
    { key: "overview", label: "Overview", href: `/campaigns/${campaignId}`, done: true },
    { key: "ideate", label: "Ideate", href: `/campaigns/${campaignId}/agents`, done: progress.ideas > 0, count: progress.ideas },
    { key: "copy", label: "Copy", href: `/campaigns/${campaignId}/copy`, done: progress.rows > 0, count: progress.rows },
    { key: "design", label: "Design", href: `/campaigns/${campaignId}/designs`, done: progress.designs > 0, count: progress.designs },
    { key: "deliverables", label: "Deliverables", href: `/campaigns/${campaignId}/deliverables`, done: progress.ready > 0, count: progress.ready },
  ];

  return (
    <nav className="flex items-center gap-1 overflow-x-auto rounded-xl ring-1 ring-white/10 bg-ink-900/40 p-1.5">
      {steps.map((s, i) => {
        const active = s.key === current;
        return (
          <div key={s.key} className="flex items-center">
            {i > 0 && <span className="px-0.5 text-ink-700 select-none">›</span>}
            <Link
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={"group flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors " +
                (active ? "bg-white/10 text-white ring-1 ring-white/15" : "text-ink-300 hover:bg-white/5 hover:text-ink-100")}
            >
              <span className={"flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-medium ring-1 " +
                (s.done ? "bg-emerald-400/20 text-emerald-200 ring-emerald-400/30" : active ? "ring-white/30 text-ink-200" : "ring-white/10 text-ink-500")}>
                {s.done ? "✓" : i + 1}
              </span>
              <span>{s.label}</span>
              {typeof s.count === "number" && s.count > 0 && (
                <span className="text-[10px] tabular-nums text-ink-400">{s.count}</span>
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
