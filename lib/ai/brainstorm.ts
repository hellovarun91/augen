import type { Brand } from "@/lib/types";
import { getClaude, claudeModel, claudeMaxTokens, extractToolUse } from "@/lib/agents/adapters/claude";
import { brainstormProjects, type BrainstormInput, type PlannedCampaign } from "./planner";

// Free-form brainstorm: Claude reads the brand + the user's goal and proposes
// projects shaped to that goal. Falls back to the deterministic, goal-aware
// generator with no key or on error — so the page always returns something useful.
export async function brainstormProjectsAI(brand: Brand, input: BrainstormInput): Promise<PlannedCampaign[]> {
  const client = getClaude();
  const goal = (input.goal || "").trim();
  if (!client || goal.length < 2) return brainstormProjects(brand, input);

  // Deterministic scaffold supplies the fields the model shouldn't have to invent
  // (channels, formats, kpis, quarter) and is the merge target for the AI content.
  const scaffold = brainstormProjects(brand, input);
  const n = scaffold.length;

  try {
    const resp = await client.messages.create({
      model: claudeModel(),
      max_tokens: claudeMaxTokens(),
      system: `You are a brand campaign strategist. Given a brand and the user's goal, propose distinct, build-ready projects — each a coherent campaign with a clear objective and a few sharp idea seeds. Be specific to THIS brand and goal; no filler, no agency clichés. Each project's ideas should be genuinely different angles, not rewordings.`,
      messages: [{
        role: "user",
        content: `Brand: ${brand.name} (${brand.industry || "lifestyle"}). Voice: ${brand.tokens.voice.description || "—"}.\nGoal: ${goal}\n\nPropose exactly ${n} projects via emit_projects. For each: a punchy name, an objective (awareness | consideration | conversion | retention), the target audience, a one-sentence rationale tied to the goal, and 3-4 idea seeds (theme, angle, one-line insight, 3 hooks).`,
      }],
      tools: [{
        name: "emit_projects",
        description: "Return the proposed projects.",
        input_schema: {
          type: "object",
          properties: {
            projects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  objective: { type: "string" },
                  audience: { type: "string" },
                  rationale: { type: "string" },
                  ideas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        theme: { type: "string" }, angle: { type: "string" }, insight: { type: "string" },
                        audience: { type: "string" }, promise: { type: "string" },
                        hooks: { type: "array", items: { type: "string" } },
                        visualDirection: { type: "string" },
                      },
                      required: ["theme", "angle", "hooks"],
                    },
                  },
                },
                required: ["name", "objective", "audience", "rationale", "ideas"],
              },
            },
          },
          required: ["projects"],
        },
      }],
      tool_choice: { type: "tool", name: "emit_projects" },
    });

    const out = extractToolUse<{ projects: Array<any> }>(resp, "emit_projects");
    if (!out?.projects?.length) return scaffold;

    // Merge AI content onto the deterministic scaffold (keep channels/formats/kpis/quarter).
    return out.projects.slice(0, n).map((p, i) => {
      const base = scaffold[i] || scaffold[0];
      const ideas = (p.ideas || []).map((idea: any) => ({
        theme: idea.theme || "Untitled idea",
        insight: idea.insight || "",
        angle: idea.angle || "",
        audience: idea.audience || p.audience || base.audience,
        promise: idea.promise || "",
        hooks: Array.isArray(idea.hooks) ? idea.hooks.slice(0, 6) : [],
        visualDirection: idea.visualDirection || "",
      }));
      return {
        ...base,
        name: p.name || base.name,
        objective: p.objective || base.objective,
        audience: p.audience || base.audience,
        rationale: p.rationale || base.rationale,
        ideas: ideas.length ? ideas : base.ideas,
      };
    });
  } catch {
    return scaffold;
  }
}
