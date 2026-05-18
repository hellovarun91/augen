import { Badge, Card, Eyebrow, Section } from "@/components/ui/primitives";
import { claudeStatus } from "@/lib/agents/adapters/claude";
import { geminiStatus, pexelsStatus, figmaStatus } from "@/lib/images/providers";

export const dynamic = "force-dynamic";

export default function ProvidersPage() {
  const claude = claudeStatus();
  const gemini = geminiStatus();
  const pexels = pexelsStatus();
  const figma = figmaStatus();

  const rows = [
    {
      name: "Claude (Anthropic)",
      env: "ANTHROPIC_API_KEY",
      model: claude.enabled ? claude.model : "—",
      status: claude.enabled,
      reason: claude.reason,
      unlocks: ["Strategist", "Copywriter", "QC Critic", "Token extraction from artwork"],
      url: "https://console.anthropic.com/",
    },
    {
      name: "Gemini (Google)",
      env: "GEMINI_API_KEY",
      model: gemini.enabled ? gemini.model : "—",
      status: gemini.enabled,
      reason: gemini.reason,
      unlocks: ["Real photographic backgrounds (Nano Banana 2)"],
      url: "https://aistudio.google.com/apikey",
    },
    {
      name: "Pexels",
      env: "PEXELS_API_KEY",
      model: "—",
      status: pexels.enabled,
      reason: pexels.reason,
      unlocks: ["Stock reference library"],
      url: "https://www.pexels.com/api/",
    },
    {
      name: "Figma",
      env: "FIGMA_PERSONAL_ACCESS_TOKEN",
      model: "—",
      status: figma.enabled,
      reason: figma.reason,
      unlocks: ["Two-way Variables sync per brand"],
      url: "https://www.figma.com/developers/api#access-tokens",
    },
  ];

  const allOn = rows.every((r) => r.status);

  return (
    <div className="px-4 py-6 md:px-8 md:py-10 max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
        <div>
          <Eyebrow>Studio settings</Eyebrow>
          <h1 className="serif text-display-lg mt-1 tracking-tight">AI providers</h1>
          <p className="text-ink-300 mt-2 max-w-2xl">
            Drop keys in <code className="text-ink-200">.env.local</code> at the repo root, restart the dev server, and Augen auto-routes to
            real APIs. No keys, no problem — every step falls back to the deterministic mock.
          </p>
        </div>
        <Badge tone={allOn ? "ok" : "warn"}>{allOn ? "All providers connected" : "Some on mock"}</Badge>
      </div>

      <Section title="Status">
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.name} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="serif text-xl">{r.name}</div>
                    <Badge tone={r.status ? "ok" : "neutral"}>{r.status ? "real" : "mock"}</Badge>
                  </div>
                  <div className="text-xs text-ink-400 mt-1">Env: <code className="text-ink-200">{r.env}</code>{r.status && r.model !== "—" ? ` · model ${r.model}` : ""}</div>
                  <div className="text-sm text-ink-200 mt-3">{r.unlocks.join(" · ")}</div>
                  {!r.status && r.reason && <div className="text-xs text-amber-200 mt-2">{r.reason}</div>}
                </div>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-ink-300 hover:text-white">Get key →</a>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="How auto-routing works">
        <Card className="p-6 text-sm text-ink-200 space-y-2">
          <p>Each agent checks the corresponding env var at call time:</p>
          <ul className="list-disc pl-5 space-y-1 text-ink-300">
            <li><span className="text-ink-100">Strategist · Copywriter · Critic · Art Director</span> — Claude if <code>ANTHROPIC_API_KEY</code> is set; otherwise mock.</li>
            <li><span className="text-ink-100">Image generation</span> — Gemini Nano Banana 2 if <code>GEMINI_API_KEY</code> is set AND the brand has no pre-loaded references; otherwise round-robin references or SVG fallback.</li>
            <li><span className="text-ink-100">Stock search</span> — Pexels if <code>PEXELS_API_KEY</code> is set.</li>
            <li><span className="text-ink-100">Figma sync</span> — pull/push enabled if <code>FIGMA_PERSONAL_ACCESS_TOKEN</code> is set.</li>
          </ul>
          <p>If a real call fails (rate limit, transient error), Augen logs the failure and falls back to the mock so the chain still completes.</p>
        </Card>
      </Section>
    </div>
  );
}
