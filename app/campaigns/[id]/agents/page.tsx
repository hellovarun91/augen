import { Badge, Card, Empty, Eyebrow, Section } from "@/components/ui/primitives";
import { listAgentRuns } from "@/lib/agents/persistence";
import { getBrand, getCampaign, getIdea, listIdeas, ideaIdsWithCopyRows, journeyProgress } from "@/lib/repo";
import { notFound } from "next/navigation";
import Link from "next/link";
import { relativeDate } from "@/lib/utils";
import { JourneyNav } from "@/components/journey-nav";
import { AgentRunControls } from "./controls";
import { Ideate } from "./ideate";

export const dynamic = "force-dynamic";

const AGENT_META: Record<string, { name: string; tone: "ok" | "info" | "warn" | "neutral" | "danger"; bullet: string }> = {
  strategist: { name: "Strategist", tone: "info", bullet: "Reads brief + brand language. Names insight, angle, audience, promise per idea." },
  art_director: { name: "Art Director", tone: "info", bullet: "Picks composition, lighting, palette emphasis. Authors the image prompt." },
  copywriter: { name: "Copywriter", tone: "info", bullet: "Spins headline / subhead / CTA variants. Listens to constraints." },
  critic: { name: "QC Critic", tone: "warn", bullet: "Scores voice fit, format ergonomics, concept strength. Decides ship / revise / kill." },
};

export default async function AgentChainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = getCampaign(id);
  if (!c) notFound();
  const b = getBrand(c.brand_id);
  if (!b) notFound();
  const ideas = listIdeas(c.id);
  const promotedIdeaIds = ideaIdsWithCopyRows(c.id);
  const ideasLite = ideas.map((i) => ({
    id: i.id, theme: i.theme, insight: i.insight, angle: i.angle,
    audience: i.audience, promise: i.promise, hooks: i.hooks,
  }));
  const runs = listAgentRuns({ campaignId: c.id }, 500);

  // Group runs by chain
  const chainMap = new Map<string, typeof runs>();
  for (const r of runs) {
    const k = r.chain_id || `solo-${r.id}`;
    const arr = chainMap.get(k) || [];
    arr.push(r);
    chainMap.set(k, arr);
  }
  const chains = Array.from(chainMap.entries()).map(([k, list]) => ({
    id: k,
    runs: list.sort((a, b) => a.created_at - b.created_at),
    startedAt: list.reduce((m, r) => Math.min(m, r.created_at), Infinity),
  })).sort((a, b) => b.startedAt - a.startedAt);

  const aggStats = {
    strategist: runs.filter((r) => r.kind === "strategist").length,
    art_director: runs.filter((r) => r.kind === "art_director").length,
    copywriter: runs.filter((r) => r.kind === "copywriter").length,
    critic: runs.filter((r) => r.kind === "critic").length,
  };

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-7xl mx-auto space-y-12">
      <div>
        <Link href={`/campaigns/${c.id}`} className="text-xs text-ink-400 hover:text-ink-100">← {c.name}</Link>
        <Eyebrow className="mt-2">{b.name} · ideate</Eyebrow>
        <h1 className="serif text-display-lg mt-1 tracking-tight">Ideate</h1>
        <p className="text-ink-300 mt-2 max-w-2xl">
          The start of the work — shape <span className="text-ink-100">what</span> to make before you make it. Steer the Strategist,
          weigh the reasoning behind each angle, and send the ones you believe in to the Copy Sheet as named variations.
        </p>
      </div>

      <JourneyNav campaignId={c.id} current="ideate" progress={journeyProgress(c.id)} />

      <Ideate campaignId={c.id} ideas={ideasLite} promotedIdeaIds={promotedIdeaIds} />

      <details className="group rounded-xl ring-1 ring-white/10 [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between text-sm text-ink-300 hover:text-ink-100">
          <span>Behind the scenes — the agents, their runs & the direct generate path</span>
          <span className="text-ink-500 group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <div className="px-5 pb-6 pt-1 space-y-10 border-t border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-5">
            {(["strategist", "art_director", "copywriter", "critic"] as const).map((k) => (
              <Card key={k} className="p-5">
                <Eyebrow>{AGENT_META[k].name}</Eyebrow>
                <div className="text-3xl font-medium mt-1">{aggStats[k]}</div>
                <div className="text-xs text-ink-400 mt-2 leading-relaxed">{AGENT_META[k].bullet}</div>
              </Card>
            ))}
          </div>

          <AgentRunControls campaignId={c.id} ideasCount={ideas.length} />

          <Section title="Recent chains" subtitle="Each chain is one direct Generate Ads run. Scroll a chain to see the agents hand off in order.">
            {chains.length === 0 ? (
              <Empty title="No runs yet">Propose angles above, or use the direct generate path — runs appear here.</Empty>
            ) : (
              <div className="space-y-8">
            {chains.slice(0, 6).map((chain) => (
              <div key={chain.id} className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <Eyebrow>Chain</Eyebrow>
                    <div className="serif text-base mt-0.5">{chain.id}</div>
                    <div className="text-[11px] text-ink-400 mt-1">{relativeDate(chain.startedAt)} · {chain.runs.length} runs</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {chain.runs.slice(0, 20).map((r) => {
                    const meta = AGENT_META[r.kind] || { name: r.kind, tone: "neutral" as const, bullet: "" };
                    const out = r.output_json ? safeJson(r.output_json) : null;
                    const idea = r.idea_id ? getIdea(r.idea_id) : null;
                    return (
                      <Card key={r.id} className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Badge tone={r.status === "ok" ? "ok" : r.status === "failed" ? "danger" : "info"}>{meta.name}</Badge>
                            {idea && <div className="text-xs text-ink-300 mt-2">{idea.theme}</div>}
                          </div>
                          <div className="text-[11px] text-ink-400 text-right">
                            <div>{relativeDate(r.created_at)}</div>
                            <div>{r.duration_ms || 0}ms · {r.provider}</div>
                          </div>
                        </div>
                        {r.rationale && (
                          <p className="text-sm text-ink-200 leading-relaxed">{r.rationale}</p>
                        )}
                        {out && r.kind === "copywriter" && Array.isArray(out.variants) && (
                          <div className="space-y-1.5 pt-1">
                            {out.variants.slice(0, 3).map((v: any, i: number) => (
                              <div key={i} className="rounded-lg ring-1 ring-white/5 p-2 text-xs text-ink-200">
                                <div className="serif text-sm">{v.headline.replace(/\n/g, " · ")}</div>
                                {v.subhead && <div className="text-ink-400 mt-0.5">{v.subhead}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                        {out && r.kind === "art_director" && (
                          <div className="text-xs text-ink-400 space-y-1 pt-1">
                            <div><span className="text-ink-200">Subject:</span> {out.subject}</div>
                            <div><span className="text-ink-200">Light:</span> {out.lighting}</div>
                          </div>
                        )}
                        {out && r.kind === "critic" && Array.isArray(out.critiques) && (
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] text-ink-400">Batch QC · {out.critiques.length} ad{out.critiques.length === 1 ? "" : "s"}</div>
                            {out.critiques.slice(0, 8).map((c: any, i: number) => (
                              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                <Badge tone={c.verdict === "ship" ? "ok" : c.verdict === "kill" ? "danger" : "warn"}>{c.verdict}</Badge>
                                <span className="text-ink-400 tabular-nums">v{Math.round((c.voiceFit || 0) * 100)} · f{Math.round((c.formatFit || 0) * 100)} · c{Math.round((c.conceptStrength || 0) * 100)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {out && r.kind === "critic" && !Array.isArray(out.critiques) && typeof out.voiceFit === "number" && (
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            <Score label="voice" val={out.voiceFit} />
                            <Score label="format" val={out.formatFit} />
                            <Score label="concept" val={out.conceptStrength} />
                          </div>
                        )}
                        {r.generation_id && (
                          <Link href={`/ads/${r.generation_id}`} className="text-xs text-ink-300 hover:text-white">View ad →</Link>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
            )}
          </Section>
        </div>
      </details>
    </div>
  );
}

function Score({ label, val }: { label: string; val: number }) {
  const pct = Math.round((val || 0) * 100);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className="text-sm text-ink-100">{pct}</div>
    </div>
  );
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
