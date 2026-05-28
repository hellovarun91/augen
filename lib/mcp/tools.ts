// MCP tool definitions + dispatch for Augen. Every tool is scoped to a user id
// (resolved from the bearer token) and checks brand membership before acting.
// `origin` (the public base URL) is threaded in so tools can render/return images.
import {
  getBrandBySlug, listBrandsForUser, listCampaignsByBrand, getCampaign,
  listGenerationsByCampaign, getGeneration, createBrand, createCampaign,
  updateGenerationStatus, updateGenerationCopy, hasBrandAccess, getBrand,
  updateBrandTokens, renameCampaign, deleteCampaign, signOffCampaign, listIdeas, getIdea,
  setGenerationWinner, getGenerationOverrides, updateGenerationOverrides,
  listAssets, createAsset, listReferences, createReference, getReference,
  listExternalWinners, createExternalWinner,
  getProjectCopySchema, listCopyRows, getCopyRow, createCopyRow, updateCopyRow, deleteCopyRow,
  listDesignsForRow, listReadyDesigns, applyCopyToRowSiblings, markRowDesignsStale,
  updateGenerationReference, getProjectSizes,
  listComments, createComment, listReviews, recordVisionReview,
  brandRole, deleteBrand,
} from "@/lib/repo";
import { addMembership, listMembershipsForBrand, getUserByEmail, createUser, pickAvatarColor } from "@/lib/users";
import { addAllowedEmail } from "@/lib/authz";
import { synthesizeBrandAI } from "@/lib/ai/brand-synth";
import { brainstormProjectsAI } from "@/lib/ai/brainstorm";
import { refineBrandAI } from "@/lib/ai/brand-refine";
import { foundationStrength } from "@/lib/brand-strength";
import { runVisionCritic } from "@/lib/agents/vision-critic";
import { parseOverrides, mergeOverrides } from "@/lib/composer/overrides";
import { rowToLayerCopy, layerCopyToRowValues, isMediaColumn } from "@/lib/copy-schema";
import { generateDesignsForRow, generateDesignsForCampaign } from "@/lib/copy-fanout";
import { rewriteCellCopy, type RewriteAction } from "@/lib/agents/copy-rewrite";
import { reviewRowCopy } from "@/lib/agents/copy-critic";
import { searchStock, generateImage, saveBytes } from "@/lib/images/providers";
import { spendByBrand } from "@/lib/spend";
import { defaultFormatSlugs } from "@/lib/formats";
import { slugify } from "@/lib/utils";
import { rateLimit } from "@/lib/ratelimit";
import { generateAdsViaAgents, strategistOnly } from "@/lib/agents/orchestrator";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, any>; required?: string[] };
}

const s = (d: string) => ({ type: "string", description: d });
const n = (d: string) => ({ type: "number", description: d });

export const TOOL_DEFS: McpTool[] = [
  // ---- Brands ----
  { name: "list_brands", description: "List the brands you can access.", inputSchema: { type: "object", properties: {} } },
  { name: "get_brand", description: "Brand detail: identity, voice, palette, and a foundation-strength score with the gaps to fix.", inputSchema: { type: "object", properties: { brand: s("Brand slug.") }, required: ["brand"] } },
  { name: "create_brand", description: "Create a brand from a one-paragraph brief (AI synthesizes the full identity).", inputSchema: { type: "object", properties: { brief: s("A paragraph describing the brand."), name: s("Optional name override.") }, required: ["brief"] } },
  { name: "refine_brand", description: "Refine a brand's design system in plain language (e.g. 'warmer palette, bolder voice'). Applies immediately.", inputSchema: { type: "object", properties: { brand: s("Brand slug."), instruction: s("What to change.") }, required: ["brand", "instruction"] } },
  { name: "delete_brand", description: "Permanently delete a brand and everything under it (projects, creatives, assets, references). Owner-only. Irreversible.", inputSchema: { type: "object", properties: { brand: s("Brand slug.") }, required: ["brand"] } },

  // ---- Projects ----
  { name: "list_projects", description: "List a brand's projects.", inputSchema: { type: "object", properties: { brand: s("Brand slug.") }, required: ["brand"] } },
  { name: "brainstorm_projects", description: "Brainstorm build-ready project drafts from a goal (does not create them).", inputSchema: { type: "object", properties: { brand: s("Brand slug."), goal: s("What you're working toward."), count: n("1-6") }, required: ["brand", "goal"] } },
  { name: "create_project", description: "Create a project under a brand.", inputSchema: { type: "object", properties: { brand: s("Brand slug."), name: s("Project name."), objective: s("awareness|consideration|conversion|retention"), audience: s("Target audience.") }, required: ["brand", "name"] } },
  { name: "rename_project", description: "Rename a project.", inputSchema: { type: "object", properties: { project: s("Project id."), name: s("New name.") }, required: ["project", "name"] } },
  { name: "delete_project", description: "Delete a project and its ideas + creatives. Irreversible.", inputSchema: { type: "object", properties: { project: s("Project id.") }, required: ["project"] } },
  { name: "sign_off_project", description: "Mark a project signed off (stakeholder approval).", inputSchema: { type: "object", properties: { project: s("Project id.") }, required: ["project"] } },

  // ---- Ideas + generation ----
  { name: "list_ideas", description: "List a project's idea seeds.", inputSchema: { type: "object", properties: { project: s("Project id.") }, required: ["project"] } },
  { name: "seed_ideas", description: "Generate idea seeds for a project (runs the Strategist).", inputSchema: { type: "object", properties: { project: s("Project id."), count: n("1-8, default 4"), notes: s("Optional steer.") }, required: ["project"] } },
  { name: "add_idea_to_copy_sheet", description: "Promote a Strategist idea into a named Copy Sheet row (hook → headline, promise → subhead). The recommended way to seed rows.", inputSchema: { type: "object", properties: { idea: s("Idea id.") }, required: ["idea"] } },
  { name: "generate_ads", description: "Run the agentic chain to generate ads for a project (legacy path; new flow is rows × fan-out — see generate_designs_for_row).", inputSchema: { type: "object", properties: { project: s("Project id.") }, required: ["project"] } },

  // ---- Creatives (incl. visual loop) ----
  { name: "list_creatives", description: "List creatives for a project or brand, with copy-QC + design scores.", inputSchema: { type: "object", properties: { project: s("Project id."), brand: s("Brand slug.") } } },
  { name: "get_creative", description: "One creative's detail (copy, scores) + render URL.", inputSchema: { type: "object", properties: { id: s("Creative id.") }, required: ["id"] } },
  { name: "view_creative", description: "Render a creative and RETURN THE IMAGE so you can actually see it (to critique layout, overflow, contrast, etc.).", inputSchema: { type: "object", properties: { id: s("Creative id.") }, required: ["id"] } },
  { name: "run_visual_qc", description: "Vision critic inspects the rendered creative (legibility, contrast, composition, safe-area, brand-fit) and returns a design score + concrete fixes.", inputSchema: { type: "object", properties: { id: s("Creative id.") }, required: ["id"] } },
  { name: "update_creative_copy", description: "Edit a creative's copy (only the fields you pass).", inputSchema: { type: "object", properties: { id: s("Creative id."), headline: s(""), subhead: s(""), cta: s(""), eyebrow: s("") }, required: ["id"] } },
  { name: "edit_creative", description: "Apply design overrides to a creative (then re-render to see the change).", inputSchema: { type: "object", properties: { id: s("Creative id."), headlineScale: n("0.5-1.6"), ctaPosition: s("auto|top-right|bottom-right|bottom-left|inline-right"), scrimOpacity: n("0-1, darkens text backdrop"), headlineYShift: n("-0.3..0.3"), imageFilter: s("none|grayscale|warm|cool|dark|light"), headlineColor: s("hex") }, required: ["id"] } },
  { name: "set_creative_status", description: "Approve, reject, or request revision on a creative.", inputSchema: { type: "object", properties: { id: s("Creative id."), status: { type: "string", enum: ["approved", "rejected", "needs_revision"] }, note: s("") }, required: ["id", "status"] } },
  { name: "mark_winner", description: "Mark/unmark a creative as a winner (feeds the agents' learning loop).", inputSchema: { type: "object", properties: { id: s("Creative id."), on: { type: "boolean", description: "default true" } }, required: ["id"] } },
  { name: "list_ready_designs", description: "Designs cleared to ship — row copy approved AND design approved AND not stale. The Deliverables gate.", inputSchema: { type: "object", properties: { project: s("Project id.") }, required: ["project"] } },
  { name: "apply_copy_to_siblings", description: "Push this design's copy onto the row's other sizes (so all siblings match). They land needing a re-look but no longer stale.", inputSchema: { type: "object", properties: { id: s("Creative id.") }, required: ["id"] } },

  // ---- Copy Sheet ----
  // The sheet is the production tool. Rows are copy variations; columns are layers
  // (headline, subhead, cta, eyebrow, plus brand-custom). Every row fans out to all
  // project formats via generate_designs_for_row.
  { name: "get_project_schema", description: "The project's Copy Sheet columns (layers) + size set (formats every row renders in). Read this before filling cells.", inputSchema: { type: "object", properties: { project: s("Project id.") }, required: ["project"] } },
  { name: "list_copy_rows", description: "List a project's Copy Sheet rows (name, status, values, designs count).", inputSchema: { type: "object", properties: { project: s("Project id.") }, required: ["project"] } },
  { name: "add_copy_row", description: "Add a new empty row to the Copy Sheet. Returns the row id.", inputSchema: { type: "object", properties: { project: s("Project id."), name: s("Variation name (e.g. \"India · festive offer\").") }, required: ["project"] } },
  { name: "set_copy_row_name", description: "Rename a copy row (this also names the designs it generates).", inputSchema: { type: "object", properties: { row: s("Copy row id."), name: s("New name.") }, required: ["row", "name"] } },
  { name: "update_copy_row_cells", description: "Update a row's cells. Pass a map { columnKey: value } — call get_project_schema to see the keys. Triggers the stale rule on the row's designs.", inputSchema: { type: "object", properties: { row: s("Copy row id."), cells: { type: "object", description: "Map of columnKey → cell value.", additionalProperties: { type: "string" } } }, required: ["row", "cells"] } },
  { name: "set_copy_row_status", description: "Set a copy row's copy-approval status: draft | proof | approved. \"approved\" is one half of the Deliverables gate.", inputSchema: { type: "object", properties: { row: s("Copy row id."), status: { type: "string", enum: ["draft", "proof", "approved"] } }, required: ["row", "status"] } },
  { name: "delete_copy_row", description: "Delete a row (and its fan-out designs).", inputSchema: { type: "object", properties: { row: s("Copy row id.") }, required: ["row"] } },
  { name: "set_row_image", description: "Attach a brand reference image to a row's image cell (use a refId from list_references / add_stock_reference / generate_reference). Pass null to clear. Triggers the stale rule.", inputSchema: { type: "object", properties: { row: s("Copy row id."), column: s("Image column key (find via get_project_schema)."), reference: s("Reference id, or null to clear.") }, required: ["row", "column"] } },
  { name: "rewrite_cell", description: "Quick AI rewrite of one cell. The row's other cells + brand voice are passed as context. Returns the proposed text (the client picks Accept/Reject — this tool does NOT mutate).", inputSchema: { type: "object", properties: { row: s("Copy row id."), column: s("Column key."), action: { type: "string", enum: ["punchier", "shorter", "match_voice"] } }, required: ["row", "column", "action"] } },
  { name: "review_row_copy", description: "Critic on the row's copy: score (0..1) + one-line fix + optional concrete single-layer rewrite. Returns the review — doesn't apply it.", inputSchema: { type: "object", properties: { row: s("Copy row id.") }, required: ["row"] } },
  { name: "generate_designs_for_row", description: "Fan one row out across the project's formats — same copy, one design per size. Deterministic (no AI image spend). Replaces any prior fan-out for the row.", inputSchema: { type: "object", properties: { row: s("Copy row id.") }, required: ["row"] } },
  { name: "generate_designs_for_project", description: "Generate designs for every row that has a headline. Capped at 60 designs total.", inputSchema: { type: "object", properties: { project: s("Project id.") }, required: ["project"] } },

  // ---- Assets / references / winners ----
  { name: "list_assets", description: "List a brand's logo/icon/asset bank.", inputSchema: { type: "object", properties: { brand: s("Brand slug.") }, required: ["brand"] } },
  { name: "add_asset", description: "Add a brand asset from an image URL (logo/mark/icon/badge/graphic).", inputSchema: { type: "object", properties: { brand: s("Brand slug."), url: s("Public image URL."), label: s(""), kind: s("logo|mark|icon|badge|graphic") }, required: ["brand", "url"] } },
  { name: "list_references", description: "List a brand's reference images.", inputSchema: { type: "object", properties: { brand: s("Brand slug.") }, required: ["brand"] } },
  { name: "add_stock_reference", description: "Search Pexels and add a stock photo to the brand's references (the engine can condition imagery on it).", inputSchema: { type: "object", properties: { brand: s("Brand slug."), query: s("Search terms."), orientation: s("landscape|portrait|square") }, required: ["brand", "query"] } },
  { name: "generate_reference", description: "Generate a reference image (Gemini) from a prompt and add it to the brand's references.", inputSchema: { type: "object", properties: { brand: s("Brand slug."), prompt: s("Image prompt.") }, required: ["brand", "prompt"] } },
  { name: "list_winners", description: "List a brand's past winners (anchors the agents).", inputSchema: { type: "object", properties: { brand: s("Brand slug.") }, required: ["brand"] } },
  { name: "add_winner", description: "Record a past winning ad's copy as an anchor.", inputSchema: { type: "object", properties: { brand: s("Brand slug."), headline: s(""), subhead: s(""), cta: s(""), eyebrow: s(""), notes: s("") }, required: ["brand", "headline"] } },

  // ---- Collaboration ----
  { name: "list_team", description: "List a brand's team members + roles.", inputSchema: { type: "object", properties: { brand: s("Brand slug.") }, required: ["brand"] } },
  { name: "invite_member", description: "Invite a teammate to a brand by email with a soft role.", inputSchema: { type: "object", properties: { brand: s("Brand slug."), email: s(""), role: s("manager|copywriter|designer|marketer|stakeholder") }, required: ["brand", "email"] } },
  { name: "list_comments", description: "List comments on a project or creative.", inputSchema: { type: "object", properties: { target: { type: "string", enum: ["project", "creative"] }, id: s("Project or creative id.") }, required: ["target", "id"] } },
  { name: "add_comment", description: "Add a comment to a project or creative.", inputSchema: { type: "object", properties: { target: { type: "string", enum: ["project", "creative"] }, id: s("Project or creative id."), body: s("Comment text.") }, required: ["target", "id", "body"] } },
  { name: "list_reviews", description: "Review history (approvals, revisions, vision-QC) for a creative.", inputSchema: { type: "object", properties: { id: s("Creative id.") }, required: ["id"] } },

  // ---- Export / spend ----
  { name: "export_project", description: "Get a download URL for a project's deliverables ZIP (SVG + PNG + manifest).", inputSchema: { type: "object", properties: { project: s("Project id.") }, required: ["project"] } },
  { name: "spend_summary", description: "Real $ AI/image spend across your brands.", inputSchema: { type: "object", properties: {} } },
];

function text(t: string) { return { content: [{ type: "text", text: t }] }; }

async function imageResult(origin: string | undefined, id: string, caption: string) {
  if (!origin) return text(caption + `\n(render: ${id} — open it in the app)`);
  try {
    const res = await fetch(`${origin}/api/render/${id}/png?w=768`, { cache: "no-store" });
    if (!res.ok) return text(caption);
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { content: [{ type: "text", text: caption }, { type: "image", data, mimeType: "image/png" }] };
  } catch { return text(caption); }
}

async function renderBytes(origin: string | undefined, id: string): Promise<{ bytes: Buffer; mime: string } | undefined> {
  if (!origin) return undefined;
  try {
    const res = await fetch(`${origin}/api/render/${id}/png?w=1024`, { cache: "no-store" });
    if (!res.ok) return undefined;
    return { bytes: Buffer.from(await res.arrayBuffer()), mime: "image/png" };
  } catch { return undefined; }
}

async function brandFromSlug(userId: string, slug: string) {
  const brand = getBrandBySlug(slug);
  if (!brand) throw new Error(`No brand with slug "${slug}".`);
  if (!hasBrandAccess(userId, brand.id)) throw new Error("You don't have access to that brand.");
  return brand;
}
function generationFor(userId: string, id: string) {
  const gen = getGeneration(id);
  if (!gen) throw new Error(`No creative "${id}".`);
  if (!hasBrandAccess(userId, gen.brand_id)) throw new Error("No access to that creative.");
  return gen;
}
function campaignFor(userId: string, id: string) {
  const c = getCampaign(id);
  if (!c || !hasBrandAccess(userId, c.brand_id)) throw new Error("No access to that project.");
  return c;
}
function rowFor(userId: string, rowId: string) {
  const row = getCopyRow(rowId);
  if (!row) throw new Error(`No copy row "${rowId}".`);
  if (!hasBrandAccess(userId, row.brand_id)) throw new Error("No access to that copy row.");
  return row;
}
const micros$ = (m: number) => `$${(m / 1_000_000).toFixed(4)}`;

export async function callTool(userId: string, name: string, args: Record<string, any>, origin?: string) {
  switch (name) {
    // ---------- Brands ----------
    case "list_brands": {
      const brands = listBrandsForUser(userId);
      return text(brands.length ? brands.map((b) => `• ${b.name} (slug: ${b.slug}) — ${b.industry || "—"} · "${b.tagline || ""}"`).join("\n") : "No brands yet. Use create_brand.");
    }
    case "get_brand": {
      const b = await brandFromSlug(userId, String(args.brand));
      const st = foundationStrength(b, { assets: listAssets(b.id).length, references: listReferences(b.id).length, winners: listExternalWinners(b.id).length });
      const gaps = st.items.filter((i) => !i.done).map((i) => i.label);
      return text([
        `${b.name} (${b.slug}) — ${b.industry || "—"}`,
        `Tagline: ${b.tagline || "—"}`,
        `Voice: ${b.tokens.voice.description || "—"} · tone: ${(b.tokens.voice.tone || []).join(", ")}`,
        `Palette: ${Object.entries(b.tokens.palette).map(([k, v]) => `${k} ${v}`).join(", ")}`,
        `Foundation strength: ${st.score}/100 (${st.band})${gaps.length ? ` · gaps: ${gaps.join(", ")}` : " · complete"}`,
      ].join("\n"));
    }
    case "create_brand": {
      const brief = String(args.brief || "").trim();
      if (brief.length < 16) throw new Error("Give a sentence or two about the brand.");
      const overrideName = String(args.name || "").trim();
      const synth = await synthesizeBrandAI(brief, overrideName ? { name: overrideName, slug: slugify(overrideName) } : undefined);
      let slug = synth.slug; let i = 2;
      while (getBrandBySlug(slug)) slug = `${synth.slug}-${i++}`;
      const brand = createBrand({ name: synth.name, slug, tagline: synth.tagline, industry: synth.industry, description: synth.description, tokens: synth.tokens });
      addMembership(userId, brand.id, "owner");
      return text(`Created "${brand.name}" (slug: ${brand.slug}). Tagline: ${synth.tagline}. Industry: ${synth.industry}.`);
    }
    case "refine_brand": {
      const b = await brandFromSlug(userId, String(args.brand));
      const instruction = String(args.instruction || "").trim();
      if (instruction.length < 2) throw new Error("Say what to change.");
      const r = await refineBrandAI(b, instruction);
      updateBrandTokens(b.id, r.tokens);
      return text(`${r.summary} (${r.viaAI ? "AI" : "heuristic"})`);
    }
    case "delete_brand": {
      const b = await brandFromSlug(userId, String(args.brand));
      if (brandRole(userId, b.id) !== "owner") throw new Error("Only the brand owner can delete it.");
      deleteBrand(b.id);
      return text(`Deleted "${b.name}" (${b.slug}) and everything under it.`);
    }

    // ---------- Projects ----------
    case "list_projects": {
      const b = await brandFromSlug(userId, String(args.brand));
      const ps = listCampaignsByBrand(b.id);
      return text(ps.length ? ps.map((p) => `• ${p.name} (id: ${p.id}) — ${p.objective || "—"} · ${p.status}`).join("\n") : `No projects in ${b.name}.`);
    }
    case "brainstorm_projects": {
      const b = await brandFromSlug(userId, String(args.brand));
      const goal = String(args.goal || "").trim();
      if (goal.length < 2) throw new Error("Give a goal.");
      const drafts = await brainstormProjectsAI(b, { goal, count: Math.max(1, Math.min(6, Math.round(Number(args.count) || 3))) });
      return text(`Drafts for "${goal}" (use create_project to keep any):\n` + drafts.map((d, i) => `${i + 1}. ${d.name} — ${d.objective} · ${d.audience}\n   seeds: ${d.ideas.slice(0, 3).map((x) => x.theme).join("; ")}`).join("\n"));
    }
    case "create_project": {
      const b = await brandFromSlug(userId, String(args.brand));
      const nm = String(args.name || "").trim();
      if (!nm) throw new Error("Project needs a name.");
      const objective = String(args.objective || "awareness");
      const audience = String(args.audience || "");
      const c = createCampaign({ brandId: b.id, name: nm, objective, audience, brief: { objective, audience, productFocus: [], channels: [], formats: defaultFormatSlugs(), budget: 0, kpis: [], notes: "" } });
      return text(`Created project "${c.name}" (id: ${c.id}).`);
    }
    case "rename_project": {
      const c = campaignFor(userId, String(args.project));
      renameCampaign(c.id, String(args.name || "").trim() || c.name);
      return text(`Renamed to "${String(args.name).trim()}".`);
    }
    case "delete_project": {
      const c = campaignFor(userId, String(args.project));
      deleteCampaign(c.id);
      return text(`Deleted project "${c.name}".`);
    }
    case "sign_off_project": {
      const c = campaignFor(userId, String(args.project));
      signOffCampaign(c.id, userId);
      return text(`Signed off "${c.name}".`);
    }

    // ---------- Ideas + generation ----------
    case "list_ideas": {
      const c = campaignFor(userId, String(args.project));
      const ideas = listIdeas(c.id);
      return text(ideas.length ? ideas.map((i) => `• ${i.theme} — ${i.angle} · ${i.audience}${(i as any).selected ? "" : " (deselected)"}`).join("\n") : "No ideas yet — use seed_ideas.");
    }
    case "seed_ideas": {
      const c = campaignFor(userId, String(args.project));
      const b = getBrand(c.brand_id)!;
      const count = Math.max(1, Math.min(8, Math.round(Number(args.count) || 4)));
      const r = await strategistOnly({ campaignId: c.id, brand: b, brief: c.brief, language: b.language, quarter: c.quarter || undefined, year: c.year || undefined, count, notes: args.notes ? String(args.notes) : undefined, userId });
      return text(`Seeded ${r.ideaCount} idea(s) on "${c.name}".`);
    }
    case "add_idea_to_copy_sheet": {
      const idea = getIdea(String(args.idea));
      if (!idea) throw new Error(`No idea "${args.idea}".`);
      const c = campaignFor(userId, idea.campaign_id);
      const schema = getProjectCopySchema(c.id);
      const values = layerCopyToRowValues(schema, {}, {
        headline: (idea.hooks[0] || idea.theme || "").slice(0, 120),
        subhead: (idea.promise || idea.insight || idea.angle || "").slice(0, 200),
        cta: "Learn more",
        eyebrow: "",
      });
      const row = createCopyRow(c.id, c.brand_id, values, (idea.theme || "Variation").slice(0, 80), idea.id);
      return text(`Row ${row.id} ("${row.name}") created from idea ${idea.id}.`);
    }
    case "generate_ads": {
      const c = campaignFor(userId, String(args.project));
      await rateLimit(userId, "generate_ads_mcp", { perMinute: 2 });
      const b = getBrand(c.brand_id)!;
      const result = await generateAdsViaAgents({ campaignId: c.id, brand: b, brief: c.brief, userId, baseUrl: origin });
      return text(`Generated ${result.generations} creative(s) for "${c.name}".`);
    }

    // ---------- Creatives ----------
    case "list_creatives": {
      let gens;
      if (args.project) gens = listGenerationsByCampaign(campaignFor(userId, String(args.project)).id);
      else if (args.brand) { const b = await brandFromSlug(userId, String(args.brand)); gens = listCampaignsByBrand(b.id).flatMap((c) => listGenerationsByCampaign(c.id)); }
      else throw new Error("Pass a project id or brand slug.");
      return text(gens.length ? gens.map((g) => `• ${g.id} — ${g.format_slug} ${g.width}x${g.height} · "${(g.headline || "").replace(/\n/g, " ")}" · ${g.status} · copy ${(g.confidence * 100).toFixed(0)}${g.design_score != null ? ` · design ${(g.design_score * 100).toFixed(0)}` : ""}${(g as any).is_winner ? " · ★" : ""}`).join("\n") : "No creatives.");
    }
    case "get_creative": {
      const g = generationFor(userId, String(args.id));
      return text([
        `Creative ${g.id} (${g.format_slug}, ${g.width}x${g.height})`,
        `Status: ${g.status} · copy ${(g.confidence * 100).toFixed(0)}${g.design_score != null ? ` · design ${(g.design_score * 100).toFixed(0)}` : ""}`,
        `Eyebrow: ${g.eyebrow || "—"} | Headline: ${g.headline} | Subhead: ${g.subhead || "—"} | CTA: ${g.cta}`,
        `Render: ${(origin || "") + "/api/render/" + g.id + "/png"}`,
      ].join("\n"));
    }
    case "view_creative": {
      const g = generationFor(userId, String(args.id));
      return imageResult(origin, g.id, `${g.format_slug} ${g.width}x${g.height} · "${(g.headline || "").replace(/\n/g, " ")}" · ${g.status}`);
    }
    case "run_visual_qc": {
      const g = generationFor(userId, String(args.id));
      const b = getBrand(g.brand_id)!;
      const png = await renderBytes(origin, g.id);
      const { output } = await runVisionCritic({ brand: b, language: b.language, formatSlug: g.format_slug, copy: { eyebrow: g.eyebrow || undefined, headline: g.headline, subhead: g.subhead || "", cta: g.cta }, png });
      recordVisionReview(g.id, { score: output.overallScore, verdict: output.verdict, notes: output.notes, fixes: output.fixes });
      return text([
        `Visual QC ${(output.overallScore * 100).toFixed(0)}/100 · ${output.verdict} (${output.viaVision ? "vision" : "heuristic"})`,
        `legibility ${(output.legibility * 100).toFixed(0)} · contrast ${(output.contrast * 100).toFixed(0)} · composition ${(output.composition * 100).toFixed(0)} · safe-area ${(output.safeArea * 100).toFixed(0)} · brand-fit ${(output.brandFit * 100).toFixed(0)}`,
        output.notes.length ? `Notes: ${output.notes.join(" ")}` : "",
        output.fixes.length ? `Fixes: ${output.fixes.join("; ")}` : "",
      ].filter(Boolean).join("\n"));
    }
    case "update_creative_copy": {
      const g = generationFor(userId, String(args.id));
      updateGenerationCopy(g.id, {
        headline: typeof args.headline === "string" ? args.headline : g.headline,
        subhead: typeof args.subhead === "string" ? args.subhead : (g.subhead || ""),
        cta: typeof args.cta === "string" ? args.cta : g.cta,
        eyebrow: typeof args.eyebrow === "string" ? args.eyebrow : (g.eyebrow || undefined),
      });
      return text(`Updated copy on ${g.id}.`);
    }
    case "edit_creative": {
      const g = generationFor(userId, String(args.id));
      const patch: any = { typography: {}, layout: {}, image: {}, colors: {} };
      if (typeof args.headlineScale === "number") patch.typography.headlineScale = args.headlineScale;
      if (typeof args.ctaPosition === "string") patch.layout.ctaPosition = args.ctaPosition;
      if (typeof args.scrimOpacity === "number") patch.layout.scrimOpacity = args.scrimOpacity;
      if (typeof args.headlineYShift === "number") patch.layout.headlineYShift = args.headlineYShift;
      if (typeof args.imageFilter === "string") patch.image.filter = args.imageFilter;
      if (typeof args.headlineColor === "string") patch.colors.headline = args.headlineColor;
      const merged = mergeOverrides(parseOverrides(getGenerationOverrides(g.id)), patch);
      updateGenerationOverrides(g.id, merged);
      return text(`Applied edits to ${g.id}. Re-render (view_creative) to see it.`);
    }
    case "set_creative_status": {
      const g = generationFor(userId, String(args.id));
      const st = String(args.status);
      if (!["approved", "rejected", "needs_revision"].includes(st)) throw new Error("status must be approved | rejected | needs_revision.");
      updateGenerationStatus(g.id, st, args.note ? String(args.note) : undefined, userId);
      return text(`Creative ${g.id} → ${st}.`);
    }
    case "mark_winner": {
      const g = generationFor(userId, String(args.id));
      const on = args.on === undefined ? true : !!args.on;
      setGenerationWinner(g.id, on);
      return text(`${g.id} ${on ? "marked a winner ★" : "unmarked"}.`);
    }
    case "list_ready_designs": {
      const c = campaignFor(userId, String(args.project));
      const ready = listReadyDesigns(c.id);
      return text(ready.length
        ? `${ready.length} design(s) ready to ship:\n` + ready.map((g) => `• ${g.id} — ${g.format_slug} ${g.width}x${g.height} · "${(g.headline || "").replace(/\n/g, " ")}"`).join("\n")
        : "Nothing ready yet. A design ships when its row copy AND visual are both approved and it isn't stale.");
    }
    case "apply_copy_to_siblings": {
      const g = generationFor(userId, String(args.id));
      const count = applyCopyToRowSiblings(g.id);
      return text(count > 0
        ? `Applied this copy to ${count} other size${count === 1 ? "" : "s"} of the same row.`
        : "No siblings to update — this design isn't fanned from a row, or it's the only size.");
    }

    // ---------- Copy Sheet ----------
    case "get_project_schema": {
      const c = campaignFor(userId, String(args.project));
      const schema = getProjectCopySchema(c.id);
      const sizes = getProjectSizes(c.id);
      const lines = [
        `Project "${c.name}" — Copy Sheet schema:`,
        "",
        "Columns (cell keys you can fill via update_copy_row_cells / rewrite_cell / set_row_image):",
        ...schema.columns.map((col) => `  • ${col.key} · "${col.label}"${col.layer !== "none" ? ` → layer:${col.layer}` : ""}${col.maxChars ? ` · ≤${col.maxChars}` : ""}${isMediaColumn(col) ? " · MEDIA" : ""}`),
        "",
        `Sizes (each row fans out to all of these): ${sizes.join(", ")}`,
      ];
      return text(lines.join("\n"));
    }
    case "list_copy_rows": {
      const c = campaignFor(userId, String(args.project));
      const rows = listCopyRows(c.id);
      if (!rows.length) return text("No copy rows.");
      return text(rows.map((r, i) => {
        const designs = listDesignsForRow(r.id);
        const stale = designs.filter((d) => d.stale).length;
        return `#${i + 1} ${r.id} · "${r.name || "(unnamed)"}" · ${r.status} · ${designs.length} design${designs.length === 1 ? "" : "s"}${stale ? ` (${stale} stale)` : ""} · ${JSON.stringify(r.values).slice(0, 120)}`;
      }).join("\n"));
    }
    case "add_copy_row": {
      const c = campaignFor(userId, String(args.project));
      const name = (args.name ? String(args.name) : "").trim().slice(0, 80);
      const row = createCopyRow(c.id, c.brand_id, {}, name, null);
      return text(`Row ${row.id} created${row.name ? ` ("${row.name}")` : ""}.`);
    }
    case "set_copy_row_name": {
      const row = rowFor(userId, String(args.row));
      const name = String(args.name || "").trim().slice(0, 80);
      updateCopyRow(row.id, { name });
      return text(`Row ${row.id} → "${name}".`);
    }
    case "update_copy_row_cells": {
      const row = rowFor(userId, String(args.row));
      const incoming = args.cells;
      if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new Error("cells must be a { columnKey: value } object.");
      const schema = getProjectCopySchema(row.campaign_id);
      const validKeys = new Set(schema.columns.map((c) => c.key));
      const merged = { ...row.values };
      const unknown: string[] = [];
      for (const [k, v] of Object.entries(incoming)) {
        if (!validKeys.has(k)) { unknown.push(k); continue; }
        merged[k] = String(v ?? "");
      }
      updateCopyRow(row.id, { values: merged });
      markRowDesignsStale(row.id);
      return text(`Updated ${Object.keys(incoming).length - unknown.length} cell(s) on row ${row.id}.${unknown.length ? ` Ignored unknown columns: ${unknown.join(", ")}.` : ""}`);
    }
    case "set_copy_row_status": {
      const row = rowFor(userId, String(args.row));
      const st = String(args.status);
      if (!["draft", "proof", "approved"].includes(st)) throw new Error("status must be draft | proof | approved.");
      updateCopyRow(row.id, { status: st });
      return text(`Row ${row.id} → ${st}.`);
    }
    case "delete_copy_row": {
      const row = rowFor(userId, String(args.row));
      const designCount = listDesignsForRow(row.id).length;
      deleteCopyRow(row.id);
      return text(`Row ${row.id} deleted.${designCount ? ` (Its ${designCount} fan-out design(s) remain in the project but are no longer linked to a row.)` : ""}`);
    }
    case "set_row_image": {
      const row = rowFor(userId, String(args.row));
      const colKey = String(args.column);
      const schema = getProjectCopySchema(row.campaign_id);
      const col = schema.columns.find((c) => c.key === colKey);
      if (!col) throw new Error(`Column "${colKey}" not in this project. Use get_project_schema.`);
      if (!isMediaColumn(col)) throw new Error(`"${col.label}" isn't a media column.`);
      const refRaw = args.reference;
      let refId: string | null = null;
      if (refRaw && typeof refRaw === "string" && refRaw.toLowerCase() !== "null") {
        const ref = getReference(refRaw);
        if (!ref || ref.brand_id !== row.brand_id) throw new Error("That reference doesn't belong to this brand.");
        refId = ref.id;
      }
      updateCopyRow(row.id, { values: { ...row.values, [colKey]: refId || "" } });
      markRowDesignsStale(row.id);
      return text(refId ? `Set row ${row.id} image → ${refId}.` : `Cleared row ${row.id} image.`);
    }
    case "rewrite_cell": {
      const row = rowFor(userId, String(args.row));
      const action = String(args.action) as RewriteAction;
      if (!["punchier", "shorter", "match_voice"].includes(action)) throw new Error("action must be punchier | shorter | match_voice.");
      const schema = getProjectCopySchema(row.campaign_id);
      const colKey = String(args.column);
      const col = schema.columns.find((c) => c.key === colKey);
      if (!col) throw new Error(`Column "${colKey}" not in this project.`);
      const b = getBrand(row.brand_id)!;
      const ctx = rowToLayerCopy(schema, row.values);
      const out = await rewriteCellCopy({
        brand: b,
        layer: (col.layer && col.layer !== "none" ? col.layer : "other") as any,
        currentText: row.values[colKey] || "",
        action,
        maxChars: col.maxChars,
        context: { ...ctx, rowName: row.name || undefined },
      });
      return text([`Proposed: ${out.proposed}`, out.rationale ? `Why: ${out.rationale}` : "", "", "(Tool returned the suggestion — call update_copy_row_cells to apply it.)"].filter(Boolean).join("\n"));
    }
    case "review_row_copy": {
      const row = rowFor(userId, String(args.row));
      const b = getBrand(row.brand_id)!;
      const schema = getProjectCopySchema(row.campaign_id);
      const copy = rowToLayerCopy(schema, row.values);
      const r = await reviewRowCopy({ brand: b, copy, rowName: row.name || undefined });
      const lines = [
        `Score: ${(r.score * 100).toFixed(0)}/100`,
        `Fix: ${r.fix}`,
      ];
      if (r.suggestion) lines.push(`Suggested ${r.suggestion.layer}: ${r.suggestion.proposed}`);
      return text(lines.join("\n"));
    }
    case "generate_designs_for_row": {
      const row = rowFor(userId, String(args.row));
      const ds = generateDesignsForRow(row.campaign_id, row.id);
      return text(`Fanned out ${ds.length} design(s) for row ${row.id}:\n` + ds.map((g) => `• ${g.id} — ${g.aspect} ${g.width}x${g.height}`).join("\n"));
    }
    case "generate_designs_for_project": {
      const c = campaignFor(userId, String(args.project));
      const res = generateDesignsForCampaign(c.id);
      return text(`Generated ${res.designs} design(s) across ${res.rows} row(s).`);
    }

    // ---------- Assets / references / winners ----------
    case "list_assets": {
      const b = await brandFromSlug(userId, String(args.brand));
      const a = listAssets(b.id);
      return text(a.length ? a.map((x) => `• ${x.id} ${x.kind}${x.role ? `/${x.role}` : ""} — ${x.label || "—"}`).join("\n") : "No assets.");
    }
    case "add_asset": {
      const b = await brandFromSlug(userId, String(args.brand));
      const res = await fetch(String(args.url), { cache: "no-store" });
      if (!res.ok) throw new Error("Could not fetch the image URL.");
      const mime = res.headers.get("content-type") || "image/png";
      if (!/^image\//.test(mime)) throw new Error("URL is not an image.");
      const saved = await saveBytes(b.slug, Buffer.from(await res.arrayBuffer()), mime);
      const kind = ["logo", "mark", "icon", "badge", "graphic"].includes(String(args.kind)) ? String(args.kind) : "logo";
      const asset = createAsset({ brandId: b.id, kind: kind as any, label: args.label ? String(args.label) : undefined, filePath: saved.publicPath, mime });
      return text(`Added ${kind} asset (${asset.id}) to ${b.name}.`);
    }
    case "list_references": {
      const b = await brandFromSlug(userId, String(args.brand));
      const r = listReferences(b.id);
      return text(r.length ? r.map((x) => `• ${x.id} ${x.kind}/${x.source} — ${x.label || "—"}${x.selected ? " ✓" : ""}`).join("\n") : "No references.");
    }
    case "add_stock_reference": {
      const b = await brandFromSlug(userId, String(args.brand));
      const orient = ["landscape", "portrait", "square"].includes(String(args.orientation)) ? String(args.orientation) : "landscape";
      const stock = await searchStock(String(args.query), orient as any);
      if (!stock) throw new Error("No stock found (or PEXELS_API_KEY not set).");
      const saved = await saveBytes(b.slug, stock.bytes, stock.mime);
      createReference({ brandId: b.id, kind: "stock", source: "pexels", label: String(args.query), filePath: saved.publicPath, mime: stock.mime, width: stock.width, height: stock.height, tags: [String(args.query)] });
      return text(`Added Pexels stock for "${args.query}" (${stock.attribution}) to ${b.name}'s references.`);
    }
    case "generate_reference": {
      const b = await brandFromSlug(userId, String(args.brand));
      const img = await generateImage(String(args.prompt), "1:1");
      if (!img) throw new Error("Image generation unavailable (GEMINI_API_KEY not set?).");
      const saved = await saveBytes(b.slug, img.bytes, img.mime);
      createReference({ brandId: b.id, kind: "generated", source: "gemini", label: String(args.prompt).slice(0, 40), prompt: String(args.prompt), filePath: saved.publicPath, mime: img.mime, width: img.width, height: img.height, tags: ["gemini"] });
      return text(`Generated + added a reference for "${String(args.prompt).slice(0, 60)}" to ${b.name}.`);
    }
    case "list_winners": {
      const b = await brandFromSlug(userId, String(args.brand));
      const w = listExternalWinners(b.id);
      return text(w.length ? w.map((x) => `• "${x.headline}" — ${x.format_slug || "—"}${x.metric_label ? ` · ${x.metric_label}` : ""}`).join("\n") : "No winners recorded.");
    }
    case "add_winner": {
      const b = await brandFromSlug(userId, String(args.brand));
      if (!String(args.headline || "").trim()) throw new Error("A winner needs at least a headline.");
      createExternalWinner({ brandId: b.id, headline: String(args.headline), subhead: args.subhead ? String(args.subhead) : undefined, cta: args.cta ? String(args.cta) : undefined, eyebrow: args.eyebrow ? String(args.eyebrow) : undefined, notes: args.notes ? String(args.notes) : undefined, source: "manual" });
      return text(`Recorded a winner for ${b.name}.`);
    }

    // ---------- Collaboration ----------
    case "list_team": {
      const b = await brandFromSlug(userId, String(args.brand));
      return text(listMembershipsForBrand(b.id).map((m) => `• ${m.user.name} (${m.user.email}) — ${m.role}`).join("\n"));
    }
    case "invite_member": {
      const b = await brandFromSlug(userId, String(args.brand));
      const e = String(args.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Enter a valid email.");
      const role = ["manager", "copywriter", "designer", "marketer", "stakeholder", "owner", "editor"].includes(String(args.role)) ? String(args.role) : "copywriter";
      let u = getUserByEmail(e);
      if (!u) u = createUser(e, e.split("@")[0].replace(/[._-]+/g, " "), pickAvatarColor(e));
      addMembership(u.id, b.id, role);
      addAllowedEmail(e, userId, "mcp invite");
      return text(`Invited ${e} to ${b.name} as ${role}.`);
    }
    case "list_comments": {
      const t = String(args.target);
      const id = String(args.id);
      if (t === "project") campaignFor(userId, id); else if (t === "creative") generationFor(userId, id); else throw new Error("target must be project | creative.");
      const cs = listComments(t, id);
      return text(cs.length ? cs.map((c) => `• ${c.author.name}: ${c.body}`).join("\n") : "No comments.");
    }
    case "add_comment": {
      const t = String(args.target); const id = String(args.id);
      let brandId: string;
      if (t === "project") brandId = campaignFor(userId, id).brand_id;
      else if (t === "creative") brandId = generationFor(userId, id).brand_id;
      else throw new Error("target must be project | creative.");
      createComment({ brandId, targetType: t, targetId: id, authorId: userId, body: String(args.body || "").trim() });
      return text(`Comment added to ${t} ${id}.`);
    }
    case "list_reviews": {
      const g = generationFor(userId, String(args.id));
      const rs = listReviews(g.id);
      return text(rs.length ? rs.map((r) => `• ${r.reviewer_name} · ${r.action}${r.note ? ` — ${r.note}` : ""}`).join("\n") : "No reviews yet.");
    }

    // ---------- Export / spend ----------
    case "export_project": {
      const c = campaignFor(userId, String(args.project));
      return text(`Deliverables ZIP: ${(origin || "") + "/api/campaigns/" + c.id + "/export.zip"}`);
    }
    case "spend_summary": {
      const mine = new Set(listBrandsForUser(userId).map((b) => b.id));
      const rows = spendByBrand().filter((r) => r.brand_id && mine.has(r.brand_id));
      if (!rows.length) return text("No AI/image spend recorded for your brands yet.");
      return text(rows.map((r) => { const b = getBrand(r.brand_id!); return `• ${b?.name || r.brand_id}: ${micros$(r.cost_micros)} over ${r.events} calls`; }).join("\n"));
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
