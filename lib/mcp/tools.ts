// MCP tool definitions + dispatch for Augen. Every tool is scoped to a user id
// (resolved from the bearer token) and checks brand membership before acting.
import {
  getBrandBySlug, listBrandsForUser, listCampaignsByBrand, getCampaign,
  listGenerationsByCampaign, getGeneration, createBrand, createCampaign,
  updateGenerationStatus, updateGenerationCopy, hasBrandAccess, getBrand,
} from "@/lib/repo";
import { addMembership } from "@/lib/users";
import { synthesizeBrandAI } from "@/lib/ai/brand-synth";
import { brainstormProjectsAI } from "@/lib/ai/brainstorm";
import { defaultFormatSlugs } from "@/lib/formats";
import { slugify } from "@/lib/utils";
import { rateLimit } from "@/lib/ratelimit";
import { generateAdsViaAgents } from "@/lib/agents/orchestrator";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, any>; required?: string[] };
}

const str = (d: string) => ({ type: "string", description: d });

export const TOOL_DEFS: McpTool[] = [
  { name: "list_brands", description: "List the brands you have access to (slug, name, industry, tagline).", inputSchema: { type: "object", properties: {} } },
  { name: "create_brand", description: "Create a new brand from a one-paragraph brief. Augen synthesizes the full identity (palette, type, voice, imagery). Returns the new brand slug.", inputSchema: { type: "object", properties: { brief: str("A paragraph describing the brand — what it sells, audience, voice."), name: str("Optional brand name override.") }, required: ["brief"] } },
  { name: "list_projects", description: "List the projects (campaigns) under a brand.", inputSchema: { type: "object", properties: { brand: str("Brand slug.") }, required: ["brand"] } },
  { name: "brainstorm_projects", description: "Brainstorm build-ready project drafts for a brand from a plain-language goal (does NOT create them). Returns drafts you can then create_project.", inputSchema: { type: "object", properties: { brand: str("Brand slug."), goal: str("What you're working toward, e.g. 'spring launch, push samples'."), count: { type: "number", description: "How many drafts (1-6)." } }, required: ["brand", "goal"] } },
  { name: "create_project", description: "Create a project (campaign) under a brand.", inputSchema: { type: "object", properties: { brand: str("Brand slug."), name: str("Project name."), objective: str("awareness | consideration | conversion | retention"), audience: str("Target audience.") }, required: ["brand", "name"] } },
  { name: "list_creatives", description: "List creatives. Pass a project id, or a brand slug for all of the brand's creatives. Includes status, copy QC confidence, and design score.", inputSchema: { type: "object", properties: { project: str("Project (campaign) id."), brand: str("Brand slug (alternative to project).") } } },
  { name: "get_creative", description: "Get one creative's full detail: copy, format, status, scores, and a render image URL.", inputSchema: { type: "object", properties: { id: str("Creative (generation) id.") }, required: ["id"] } },
  { name: "set_creative_status", description: "Approve, reject, or request revision on a creative.", inputSchema: { type: "object", properties: { id: str("Creative id."), status: { type: "string", enum: ["approved", "rejected", "needs_revision"] }, note: str("Optional reviewer note.") }, required: ["id", "status"] } },
  { name: "update_creative_copy", description: "Edit a creative's copy. Only the fields you pass are changed.", inputSchema: { type: "object", properties: { id: str("Creative id."), headline: str(""), subhead: str(""), cta: str(""), eyebrow: str("") }, required: ["id"] } },
  { name: "generate_ads", description: "Run the agentic chain to generate ads for a project from its idea seeds. Costs real AI/image spend; rate-limited.", inputSchema: { type: "object", properties: { project: str("Project (campaign) id.") }, required: ["project"] } },
];

function text(s: string) { return { content: [{ type: "text", text: s }] }; }

async function brandFromSlug(userId: string, slug: string) {
  const brand = getBrandBySlug(slug);
  if (!brand) throw new Error(`No brand with slug "${slug}".`);
  if (!hasBrandAccess(userId, brand.id)) throw new Error("You don't have access to that brand.");
  return brand;
}
async function generationFor(userId: string, id: string) {
  const gen = getGeneration(id);
  if (!gen) throw new Error(`No creative with id "${id}".`);
  if (!hasBrandAccess(userId, gen.brand_id)) throw new Error("You don't have access to that creative.");
  return gen;
}

export async function callTool(userId: string, name: string, args: Record<string, any>) {
  switch (name) {
    case "list_brands": {
      const brands = listBrandsForUser(userId);
      if (!brands.length) return text("You have no brands yet. Use create_brand to make one.");
      return text(brands.map((b) => `• ${b.name} (slug: ${b.slug}) — ${b.industry || "—"} · "${b.tagline || ""}"`).join("\n"));
    }
    case "create_brand": {
      const brief = String(args.brief || "").trim();
      if (brief.length < 16) throw new Error("Give a sentence or two describing the brand.");
      const overrideName = String(args.name || "").trim();
      const synth = await synthesizeBrandAI(brief, overrideName ? { name: overrideName, slug: slugify(overrideName) } : undefined);
      let slug = synth.slug; let n = 2;
      while (getBrandBySlug(slug)) slug = `${synth.slug}-${n++}`;
      const brand = createBrand({ name: synth.name, slug, tagline: synth.tagline, industry: synth.industry, description: synth.description, tokens: synth.tokens });
      addMembership(userId, brand.id, "owner");
      return text(`Created "${brand.name}" (slug: ${brand.slug}).\nTagline: ${synth.tagline}\nIndustry: ${synth.industry}\nOpen it at /brands/${brand.slug}`);
    }
    case "list_projects": {
      const brand = await brandFromSlug(userId, String(args.brand));
      const projects = listCampaignsByBrand(brand.id);
      if (!projects.length) return text(`No projects in ${brand.name} yet.`);
      return text(projects.map((p) => `• ${p.name} (id: ${p.id}) — ${p.objective || "—"} · status ${p.status}`).join("\n"));
    }
    case "brainstorm_projects": {
      const brand = await brandFromSlug(userId, String(args.brand));
      const goal = String(args.goal || "").trim();
      if (goal.length < 2) throw new Error("Tell it what you're working toward.");
      const count = Math.max(1, Math.min(6, Math.round(Number(args.count) || 3)));
      const drafts = await brainstormProjectsAI(brand, { goal, count });
      return text(`Drafts for "${goal}" (not created yet — use create_project to keep any):\n` +
        drafts.map((d, i) => `${i + 1}. ${d.name} — ${d.objective}\n   audience: ${d.audience}\n   seeds: ${d.ideas.slice(0, 3).map((x) => x.theme).join("; ")}`).join("\n"));
    }
    case "create_project": {
      const brand = await brandFromSlug(userId, String(args.brand));
      const name = String(args.name || "").trim();
      if (!name) throw new Error("Project needs a name.");
      const objective = String(args.objective || "awareness");
      const audience = String(args.audience || "");
      const campaign = createCampaign({
        brandId: brand.id, name, objective, audience,
        brief: { objective, audience, productFocus: [], channels: [], formats: defaultFormatSlugs(), budget: 0, kpis: [], notes: "" },
      });
      return text(`Created project "${campaign.name}" (id: ${campaign.id}) in ${brand.name}. Add idea seeds or call generate_ads.`);
    }
    case "list_creatives": {
      let gens;
      if (args.project) {
        const camp = getCampaign(String(args.project));
        if (!camp || !hasBrandAccess(userId, camp.brand_id)) throw new Error("No access to that project.");
        gens = listGenerationsByCampaign(camp.id);
      } else if (args.brand) {
        const brand = await brandFromSlug(userId, String(args.brand));
        gens = listCampaignsByBrand(brand.id).flatMap((c) => listGenerationsByCampaign(c.id));
      } else throw new Error("Pass either a project id or a brand slug.");
      if (!gens.length) return text("No creatives found.");
      return text(gens.map((g) => `• ${g.id} — ${g.format_slug} · "${(g.headline || "").replace(/\n/g, " ")}" · ${g.status} · copy ${(g.confidence * 100).toFixed(0)}${g.design_score != null ? ` · design ${(g.design_score * 100).toFixed(0)}` : ""}`).join("\n"));
    }
    case "get_creative": {
      const g = await generationFor(userId, String(args.id));
      const brand = getBrand(g.brand_id);
      const origin = process.env.AUGEN_PUBLIC_URL || "";
      return text([
        `Creative ${g.id} (${g.format_slug}, ${g.width}×${g.height})`,
        `Status: ${g.status} · copy QC ${(g.confidence * 100).toFixed(0)}${g.design_score != null ? ` · design ${(g.design_score * 100).toFixed(0)}` : ""}`,
        `Eyebrow: ${g.eyebrow || "—"}`,
        `Headline: ${g.headline}`,
        `Subhead: ${g.subhead || "—"}`,
        `CTA: ${g.cta}`,
        `Render: ${origin}/api/render/${g.id}/png`,
        brand ? `Brand: ${brand.name} (${brand.slug})` : "",
      ].filter(Boolean).join("\n"));
    }
    case "set_creative_status": {
      const g = await generationFor(userId, String(args.id));
      const status = String(args.status);
      if (!["approved", "rejected", "needs_revision"].includes(status)) throw new Error("status must be approved | rejected | needs_revision.");
      updateGenerationStatus(g.id, status, args.note ? String(args.note) : undefined, userId);
      return text(`Creative ${g.id} → ${status}.`);
    }
    case "update_creative_copy": {
      const g = await generationFor(userId, String(args.id));
      updateGenerationCopy(g.id, {
        headline: typeof args.headline === "string" ? args.headline : g.headline,
        subhead: typeof args.subhead === "string" ? args.subhead : (g.subhead || ""),
        cta: typeof args.cta === "string" ? args.cta : g.cta,
        eyebrow: typeof args.eyebrow === "string" ? args.eyebrow : (g.eyebrow || undefined),
      });
      return text(`Updated copy on ${g.id}.`);
    }
    case "generate_ads": {
      const camp = getCampaign(String(args.project));
      if (!camp || !hasBrandAccess(userId, camp.brand_id)) throw new Error("No access to that project.");
      await rateLimit(userId, "generate_ads_mcp", { perMinute: 2 });
      const brand = getBrand(camp.brand_id);
      if (!brand) throw new Error("Brand missing.");
      const result = await generateAdsViaAgents({ campaignId: camp.id, brand, brief: camp.brief, userId });
      return text(`Generated ${result.generations} creative(s) for "${camp.name}". Review them in the Studio or with list_creatives.`);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
