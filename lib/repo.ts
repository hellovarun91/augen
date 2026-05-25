import { db, nowMs } from "./db";
import { nanoid } from "nanoid";
import { createHash, randomBytes } from "crypto";
import { BrandLanguage, BrandTokens, type Brand, type BrandRow, type Campaign, type CampaignRow, type CampaignBrief, type Generation, type GenerationRow, type Idea, type IdeaRow } from "./types";
import { parseCopySchema, defaultCopySchema, type CopySchema } from "./copy-schema";

export function listBrands(): Brand[] {
  const rows = db().prepare("SELECT * FROM brands ORDER BY created_at DESC").all() as BrandRow[];
  return rows.map(hydrateBrand);
}

export function listBrandsForUser(userId: string): Brand[] {
  const rows = db().prepare(`
    SELECT b.* FROM brands b
    INNER JOIN memberships m ON m.brand_id = b.id
    WHERE m.user_id = ?
    ORDER BY b.created_at DESC
  `).all(userId) as BrandRow[];
  return rows.map(hydrateBrand);
}

export function getBrandBySlug(slug: string): Brand | null {
  const row = db().prepare("SELECT * FROM brands WHERE slug = ?").get(slug) as BrandRow | undefined;
  return row ? hydrateBrand(row) : null;
}

export function getBrand(id: string): Brand | null {
  const row = db().prepare("SELECT * FROM brands WHERE id = ?").get(id) as BrandRow | undefined;
  return row ? hydrateBrand(row) : null;
}

export function hydrateBrand(row: BrandRow): Brand {
  const tokens = BrandTokens.parse(JSON.parse(row.tokens));
  const language: BrandLanguage = row.language
    ? BrandLanguage.parse(JSON.parse(row.language))
    : BrandLanguage.parse({
        voiceDescription: tokens.voice.description,
        doNotRules: tokens.voice.doNot,
        toneSliders: { formal_casual: 0, serious_playful: 0, reserved_bold: 0, classic_modern: 0 },
      });
  return {
    ...row,
    tokens,
    refs: row.refs ? JSON.parse(row.refs) : [],
    language,
  };
}

export function updateBrandLanguage(id: string, language: BrandLanguage): Brand {
  const parsed = BrandLanguage.parse(language);
  db().prepare("UPDATE brands SET language = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(parsed), nowMs(), id);
  return getBrand(id)!;
}

export function updateBrandFigmaUrl(id: string, figmaUrl: string | null): Brand {
  db().prepare("UPDATE brands SET figma_file_url = ?, updated_at = ? WHERE id = ?").run(figmaUrl, nowMs(), id);
  return getBrand(id)!;
}

export function getBrandFigmaUrl(id: string): string | null {
  const r = db().prepare("SELECT figma_file_url FROM brands WHERE id = ?").get(id) as { figma_file_url: string | null } | undefined;
  return r?.figma_file_url || null;
}

export interface NewBrand {
  name: string;
  slug: string;
  tagline?: string;
  industry?: string;
  description?: string;
  tokens: BrandTokens;
}

export function createBrand(input: NewBrand): Brand {
  const id = `brnd_${nanoid(10)}`;
  const now = nowMs();
  const language: BrandLanguage = BrandLanguage.parse({
    voiceDescription: input.tokens.voice.description,
    toneSliders: { formal_casual: 0, serious_playful: 0, reserved_bold: 0, classic_modern: 0 },
    doNotRules: input.tokens.voice.doNot,
    doRules: [],
    preferredWords: [],
    bannedWords: input.tokens.voice.doNot.filter((s) => /^[a-z' -]+$/i.test(s) && s.split(" ").length <= 3),
    sampleSentences: [],
  });
  db().prepare(`
    INSERT INTO brands (id, slug, name, tagline, industry, description, voice, tokens, refs, status, language, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `).run(
    id,
    input.slug,
    input.name,
    input.tagline || null,
    input.industry || null,
    input.description || null,
    input.tokens.voice.description,
    JSON.stringify(input.tokens),
    JSON.stringify([]),
    JSON.stringify(language),
    now,
    now,
  );
  // Create billing account (kept — only surfaces when explicit Launch flow is used)
  db().prepare(`
    INSERT INTO billing_accounts (id, brand_id, plan, balance_cents, monthly_budget_cents, created_at)
    VALUES (?, ?, 'studio', 50000, 100000, ?)
  `).run(`bill_${nanoid(10)}`, id, now);
  return getBrand(id)!;
}

export function updateBrandTokens(id: string, tokens: BrandTokens): Brand {
  db().prepare("UPDATE brands SET tokens = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(tokens), nowMs(), id);
  return getBrand(id)!;
}

export function updateBrandFields(id: string, patch: Partial<Pick<BrandRow, "name" | "tagline" | "industry" | "description">>) {
  const fields = Object.keys(patch);
  if (!fields.length) return getBrand(id);
  const setSql = fields.map((f) => `${f} = ?`).join(", ");
  const vals = fields.map((f) => (patch as any)[f]);
  db().prepare(`UPDATE brands SET ${setSql}, updated_at = ? WHERE id = ?`).run(...vals, nowMs(), id);
  return getBrand(id);
}

// ---------- Campaigns ----------

export function createCampaign(input: {
  brandId: string;
  name: string;
  quarter?: string;
  year?: number;
  objective?: string;
  audience?: string;
  brief: CampaignBrief;
  templateId?: string;
}): Campaign {
  const id = `cmp_${nanoid(10)}`;
  const now = nowMs();
  db().prepare(`
    INSERT INTO campaigns (id, brand_id, name, quarter, year, objective, audience, brief, template_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
  `).run(
    id, input.brandId, input.name,
    input.quarter || null, input.year || null,
    input.objective || null, input.audience || null,
    JSON.stringify(input.brief), input.templateId || null,
    now, now,
  );
  return getCampaign(id)!;
}

export function getCampaign(id: string): Campaign | null {
  const row = db().prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as CampaignRow | undefined;
  if (!row) return null;
  return { ...row, brief: JSON.parse(row.brief) as CampaignBrief };
}

export function listCampaignsByBrand(brandId: string): Campaign[] {
  const rows = db().prepare("SELECT * FROM campaigns WHERE brand_id = ? ORDER BY created_at DESC").all(brandId) as CampaignRow[];
  return rows.map((r) => ({ ...r, brief: JSON.parse(r.brief) as CampaignBrief }));
}

export function listAllCampaigns(): Campaign[] {
  const rows = db().prepare("SELECT * FROM campaigns ORDER BY created_at DESC").all() as CampaignRow[];
  return rows.map((r) => ({ ...r, brief: JSON.parse(r.brief) as CampaignBrief }));
}

export function setCampaignStatus(id: string, status: string) {
  db().prepare("UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?").run(status, nowMs(), id);
}

export function renameCampaign(id: string, name: string) {
  db().prepare("UPDATE campaigns SET name = ?, updated_at = ? WHERE id = ?").run(name, nowMs(), id);
}

export function updateCampaignBasics(id: string, patch: { name?: string; objective?: string; audience?: string }) {
  const c = getCampaign(id);
  if (!c) return;
  const name = patch.name?.trim() || c.name;
  const objective = patch.objective ?? c.objective ?? "";
  const audience = patch.audience ?? c.audience ?? "";
  const brief = { ...c.brief, objective, audience };
  db().prepare("UPDATE campaigns SET name = ?, objective = ?, audience = ?, brief = ?, updated_at = ? WHERE id = ?")
    .run(name, objective, audience, JSON.stringify(brief), nowMs(), id);
}

// Children (ideas, generations, formats, variation batches) cascade-delete via FK.
export function deleteCampaign(id: string) {
  db().prepare("DELETE FROM campaigns WHERE id = ?").run(id);
}

// ---------- Ideas ----------

export function createIdea(input: {
  campaignId: string;
  theme: string;
  insight?: string;
  angle: string;
  audience: string;
  promise?: string;
  hooks: string[];
  visualDirection?: string;
  orderIdx: number;
}): Idea {
  const id = `idea_${nanoid(10)}`;
  db().prepare(`
    INSERT INTO ideas (id, campaign_id, theme, insight, angle, audience, promise, hooks, visual_direction, selected, order_idx, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    id, input.campaignId, input.theme, input.insight || null,
    input.angle, input.audience, input.promise || null,
    JSON.stringify(input.hooks), input.visualDirection || null,
    input.orderIdx, nowMs(),
  );
  return getIdea(id)!;
}

export function getIdea(id: string): Idea | null {
  const row = db().prepare("SELECT * FROM ideas WHERE id = ?").get(id) as IdeaRow | undefined;
  if (!row) return null;
  return { ...row, hooks: JSON.parse(row.hooks || "[]") };
}

export function listIdeas(campaignId: string): Idea[] {
  const rows = db().prepare("SELECT * FROM ideas WHERE campaign_id = ? ORDER BY order_idx ASC").all(campaignId) as IdeaRow[];
  return rows.map((r) => ({ ...r, hooks: JSON.parse(r.hooks || "[]") }));
}

// ---------- Generations ----------

export interface NewGen {
  campaignId: string;
  ideaId: string;
  brandId: string;
  formatSlug: string;
  aspect: string;
  width: number;
  height: number;
  headline: string;
  subhead: string;
  cta: string;
  eyebrow?: string;
  copy: { headline: string; subhead: string; cta: string; eyebrow?: string }[];
  imagePrompt: string;
  imageSeed: number;
  imageStyle: string;
  palette: string[];
  confidence: number;
  costCents: number;
}

export function createGeneration(input: NewGen): Generation {
  const id = `gen_${nanoid(12)}`;
  const now = nowMs();
  db().prepare(`
    INSERT INTO generations (
      id, campaign_id, idea_id, brand_id, format_slug, aspect, width, height,
      headline, subhead, cta, eyebrow,
      copy_json, image_prompt, image_seed, image_style, palette,
      status, confidence, cost_cents, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?, ?, ?, ?)
  `).run(
    id, input.campaignId, input.ideaId, input.brandId,
    input.formatSlug, input.aspect, input.width, input.height,
    input.headline, input.subhead, input.cta, input.eyebrow || null,
    JSON.stringify(input.copy), input.imagePrompt, input.imageSeed, input.imageStyle,
    JSON.stringify(input.palette), input.confidence, input.costCents, now, now,
  );
  return getGeneration(id)!;
}

export function getGeneration(id: string): Generation | null {
  const row = db().prepare("SELECT * FROM generations WHERE id = ?").get(id) as GenerationRow | undefined;
  if (!row) return null;
  return { ...row, copy: JSON.parse(row.copy_json || "[]"), palette: JSON.parse(row.palette || "[]") };
}

export function listGenerationsByCampaign(campaignId: string): Generation[] {
  const rows = db().prepare("SELECT * FROM generations WHERE campaign_id = ? ORDER BY created_at ASC").all(campaignId) as GenerationRow[];
  return rows.map((r) => ({ ...r, copy: JSON.parse(r.copy_json || "[]"), palette: JSON.parse(r.palette || "[]") }));
}

export function listGenerationsByStatus(status: string, limit = 100): Generation[] {
  const rows = db().prepare("SELECT * FROM generations WHERE status = ? ORDER BY created_at DESC LIMIT ?").all(status, limit) as GenerationRow[];
  return rows.map((r) => ({ ...r, copy: JSON.parse(r.copy_json || "[]"), palette: JSON.parse(r.palette || "[]") }));
}

export function listAllGenerations(limit = 500): Generation[] {
  const rows = db().prepare("SELECT * FROM generations ORDER BY created_at DESC LIMIT ?").all(limit) as GenerationRow[];
  return rows.map((r) => ({ ...r, copy: JSON.parse(r.copy_json || "[]"), palette: JSON.parse(r.palette || "[]") }));
}

export function updateGenerationStatus(id: string, status: string, note?: string, reviewerId?: string) {
  db().prepare("UPDATE generations SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?").run(
    status, note ?? null, nowMs(), id,
  );
  const rev = `rev_${nanoid(8)}`;
  db().prepare("INSERT INTO reviews (id, generation_id, action, note, reviewer, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    rev, id, status, note ?? null, reviewerId ?? "studio", nowMs(),
  );
}

// ---------- API tokens (programmatic / MCP access) ----------
export interface ApiTokenRow {
  id: string; user_id: string; name: string; created_at: number; last_used_at: number | null;
}

function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

// Creates a token, returns the PLAINTEXT once (only the hash is stored).
export function createApiToken(userId: string, name: string): { token: string; row: ApiTokenRow } {
  const id = `tok_${nanoid(10)}`;
  const plaintext = `augen_${randomBytes(24).toString("hex")}`;
  db().prepare("INSERT INTO api_tokens (id, user_id, name, token_hash, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, userId, name.trim() || "Untitled token", hashToken(plaintext), nowMs());
  const row = db().prepare("SELECT id, user_id, name, created_at, last_used_at FROM api_tokens WHERE id = ?").get(id) as ApiTokenRow;
  return { token: plaintext, row };
}

export function listApiTokens(userId: string): ApiTokenRow[] {
  return db().prepare("SELECT id, user_id, name, created_at, last_used_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC").all(userId) as ApiTokenRow[];
}

export function revokeApiToken(id: string, userId: string) {
  db().prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?").run(id, userId);
}

// Resolves a plaintext token to its user id (and stamps last_used_at).
export function resolveApiToken(plaintext: string): string | null {
  if (!plaintext || !plaintext.startsWith("augen_")) return null;
  const row = db().prepare("SELECT id, user_id FROM api_tokens WHERE token_hash = ?").get(hashToken(plaintext)) as { id: string; user_id: string } | undefined;
  if (!row) return null;
  db().prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(nowMs(), row.id);
  return row.user_id;
}

// ---------- Device-authorization codes (Figma "Connect account") ----------
const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;

export function createDeviceCode(): { code: string } {
  const code = randomBytes(18).toString("hex");
  const now = nowMs();
  db().prepare("INSERT INTO device_codes (code, status, created_at, expires_at) VALUES (?, 'pending', ?, ?)")
    .run(code, now, now + DEVICE_CODE_TTL_MS);
  return { code };
}

export function getDeviceCode(code: string): { code: string; status: string; user_id: string | null; expires_at: number } | null {
  return (db().prepare("SELECT code, status, user_id, expires_at FROM device_codes WHERE code = ?").get(code) as any) || null;
}

// Called from the authenticated /connect approval — binds a freshly minted token.
export function approveDeviceCode(code: string, userId: string, token: string): boolean {
  const row = getDeviceCode(code);
  if (!row || row.status !== "pending" || row.expires_at < nowMs()) return false;
  db().prepare("UPDATE device_codes SET status = 'approved', user_id = ?, token = ? WHERE code = ?").run(userId, token, code);
  return true;
}

// Plugin polls this. Returns the token exactly once, then deletes the row.
export function pollDeviceCode(code: string): { status: "pending" | "approved" | "expired"; token?: string } {
  const row = db().prepare("SELECT * FROM device_codes WHERE code = ?").get(code) as any;
  if (!row || row.expires_at < nowMs()) {
    if (row) db().prepare("DELETE FROM device_codes WHERE code = ?").run(code);
    return { status: "expired" };
  }
  if (row.status === "approved" && row.token) {
    db().prepare("DELETE FROM device_codes WHERE code = ?").run(code);
    return { status: "approved", token: row.token };
  }
  return { status: "pending" };
}

// Membership-based access check (token-scoped, no session).
export function hasBrandAccess(userId: string, brandId: string): boolean {
  const m = db().prepare("SELECT 1 FROM memberships WHERE user_id = ? AND brand_id = ? LIMIT 1").get(userId, brandId);
  return !!m;
}

// The user's role on a brand (owner | editor | manager | …), or null if not a member.
export function brandRole(userId: string, brandId: string): string | null {
  const r = db().prepare("SELECT role FROM memberships WHERE user_id = ? AND brand_id = ? LIMIT 1").get(userId, brandId) as { role: string } | undefined;
  return r?.role || null;
}

// Delete a brand and everything under it. Most child tables cascade via FK
// (campaigns→generations/ideas, references, assets, winners, copy_rows,
// figma_webhooks…); the rest (memberships, comments, spend) are cleared here.
export function deleteBrand(id: string) {
  const d = db();
  for (const t of ["memberships", "comments", "api_spend"]) {
    try { d.prepare(`DELETE FROM ${t} WHERE brand_id = ?`).run(id); } catch { /* table/col may not exist */ }
  }
  d.prepare("DELETE FROM brands WHERE id = ?").run(id);
}

// ---------- Figma design-token mapping (per brand) ----------
export interface TokenMapStage { vars: Array<{ name: string; value: string | number; type?: string }>; mapping: Record<string, string>; viaAI: boolean }

export function getSavedTokenMapping(brandId: string): Record<string, string> | null {
  const r = db().prepare("SELECT mapping_json FROM figma_token_maps WHERE brand_id = ?").get(brandId) as { mapping_json: string | null } | undefined;
  return r?.mapping_json ? JSON.parse(r.mapping_json) : null;
}
export function getTokenStage(brandId: string): TokenMapStage | null {
  const r = db().prepare("SELECT staged_json FROM figma_token_maps WHERE brand_id = ?").get(brandId) as { staged_json: string | null } | undefined;
  return r?.staged_json ? JSON.parse(r.staged_json) : null;
}
function upsertTokenMapRow(brandId: string, patch: { mapping?: string | null; staged?: string | null }) {
  const existing = db().prepare("SELECT brand_id FROM figma_token_maps WHERE brand_id = ?").get(brandId);
  if (existing) {
    if (patch.mapping !== undefined) db().prepare("UPDATE figma_token_maps SET mapping_json = ?, updated_at = ? WHERE brand_id = ?").run(patch.mapping, nowMs(), brandId);
    if (patch.staged !== undefined) db().prepare("UPDATE figma_token_maps SET staged_json = ?, updated_at = ? WHERE brand_id = ?").run(patch.staged, nowMs(), brandId);
  } else {
    db().prepare("INSERT INTO figma_token_maps (brand_id, mapping_json, staged_json, updated_at) VALUES (?, ?, ?, ?)").run(brandId, patch.mapping ?? null, patch.staged ?? null, nowMs());
  }
}
export function stageTokenMapping(brandId: string, stage: TokenMapStage) { upsertTokenMapRow(brandId, { staged: JSON.stringify(stage) }); }
export function saveTokenMapping(brandId: string, mapping: Record<string, string>) { upsertTokenMapRow(brandId, { mapping: JSON.stringify(mapping), staged: null }); }
export function clearTokenStage(brandId: string) { upsertTokenMapRow(brandId, { staged: null }); }

// ---------- Figma live-sync webhooks ----------
export interface FigmaWebhookRow {
  brand_id: string; team_id: string; file_key: string; webhook_id: string;
  passcode: string; endpoint: string; active: number;
  last_event_at: number | null; last_status: string | null; created_at: number;
}

export function getFigmaWebhookByBrand(brandId: string): FigmaWebhookRow | null {
  return (db().prepare("SELECT * FROM figma_webhooks WHERE brand_id = ?").get(brandId) as FigmaWebhookRow) || null;
}
export function getFigmaWebhookByWebhookId(webhookId: string): FigmaWebhookRow | null {
  return (db().prepare("SELECT * FROM figma_webhooks WHERE webhook_id = ?").get(webhookId) as FigmaWebhookRow) || null;
}
export function upsertFigmaWebhook(row: Omit<FigmaWebhookRow, "last_event_at" | "last_status" | "created_at">) {
  db().prepare(`
    INSERT INTO figma_webhooks (brand_id, team_id, file_key, webhook_id, passcode, endpoint, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_id) DO UPDATE SET team_id = excluded.team_id, file_key = excluded.file_key,
      webhook_id = excluded.webhook_id, passcode = excluded.passcode, endpoint = excluded.endpoint, active = excluded.active
  `).run(row.brand_id, row.team_id, row.file_key, row.webhook_id, row.passcode, row.endpoint, row.active, nowMs());
}
export function setFigmaWebhookEvent(webhookId: string, status: string) {
  db().prepare("UPDATE figma_webhooks SET last_event_at = ?, last_status = ? WHERE webhook_id = ?").run(nowMs(), status, webhookId);
}
export function deleteFigmaWebhook(brandId: string) {
  db().prepare("DELETE FROM figma_webhooks WHERE brand_id = ?").run(brandId);
}

// Logs that the agentic chain auto-revised a creative (shows in the review timeline).
export function recordAgentRevision(generationId: string, note: string) {
  const rev = `rev_${nanoid(8)}`;
  db().prepare("INSERT INTO reviews (id, generation_id, action, note, reviewer, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(rev, generationId, "auto-revised", note || null, "auto-revise", nowMs());
}

// Persist a Vision QC critique: store the design score + notes on the generation,
// and log a review row attributed to "vision-critic" so it shows in the timeline.
export function recordVisionReview(generationId: string, input: { score: number; verdict: string; notes: string[]; fixes?: string[] }) {
  const note = [
    input.notes.length ? input.notes.join(" ") : "",
    input.fixes && input.fixes.length ? `Fixes: ${input.fixes.join("; ")}` : "",
  ].filter(Boolean).join(" — ");
  db().prepare("UPDATE generations SET design_score = ?, design_notes = ?, updated_at = ? WHERE id = ?")
    .run(input.score, note || null, nowMs(), generationId);
  const rev = `rev_${nanoid(8)}`;
  db().prepare("INSERT INTO reviews (id, generation_id, action, note, reviewer, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(rev, generationId, `visual:${input.verdict}`, note || null, "vision-critic", nowMs());
}

export interface ReviewRow {
  id: string; generation_id: string; action: string; note: string | null;
  reviewer: string | null; created_at: number;
  reviewer_name: string; reviewer_color: string;
}

// Review history for a creative, newest first, with the human reviewer resolved.
export function listReviews(generationId: string): ReviewRow[] {
  const rows = db().prepare(`
    SELECT r.*, u.name u_name, u.avatar_color u_color
    FROM reviews r LEFT JOIN users u ON u.id = r.reviewer
    WHERE r.generation_id = ?
    ORDER BY r.created_at DESC
  `).all(generationId) as any[];
  return rows.map((r) => ({
    id: r.id, generation_id: r.generation_id, action: r.action, note: r.note,
    reviewer: r.reviewer, created_at: r.created_at,
    reviewer_name: r.u_name || (r.reviewer === "studio" ? "Studio" : r.reviewer || "Someone"),
    reviewer_color: r.u_color || "#8A8A93",
  }));
}

// ---------- Project sign-off (stakeholder approval) ----------
export function signOffCampaign(id: string, userId: string) {
  db().prepare("UPDATE campaigns SET signed_off_by = ?, signed_off_at = ?, status = 'approved', updated_at = ? WHERE id = ?")
    .run(userId, nowMs(), nowMs(), id);
}
export function clearCampaignSignoff(id: string) {
  db().prepare("UPDATE campaigns SET signed_off_by = NULL, signed_off_at = NULL, updated_at = ? WHERE id = ?")
    .run(nowMs(), id);
}

export function updateGenerationReference(generationId: string, referenceId: string | null) {
  db().prepare("UPDATE generations SET reference_id = ?, updated_at = ? WHERE id = ?").run(referenceId, nowMs(), generationId);
}

export function getGenerationOverrides(generationId: string): unknown {
  const row = db().prepare("SELECT overrides_json FROM generations WHERE id = ?").get(generationId) as { overrides_json: string | null } | undefined;
  if (!row?.overrides_json) return null;
  try { return JSON.parse(row.overrides_json); } catch { return null; }
}

export function updateGenerationOverrides(generationId: string, overrides: unknown) {
  db().prepare("UPDATE generations SET overrides_json = ?, updated_at = ? WHERE id = ?").run(
    overrides == null ? null : JSON.stringify(overrides),
    nowMs(),
    generationId,
  );
}

export function updateGenerationCopy(id: string, copy: { headline: string; subhead: string; cta: string; eyebrow?: string }) {
  db().prepare(`UPDATE generations SET headline = ?, subhead = ?, cta = ?, eyebrow = ?, updated_at = ? WHERE id = ?`).run(
    copy.headline, copy.subhead, copy.cta, copy.eyebrow || null, nowMs(), id,
  );
}

// ---------- Billing ----------

export function getBilling(brandId: string) {
  return db().prepare("SELECT * FROM billing_accounts WHERE brand_id = ?").get(brandId) as
    | { id: string; brand_id: string; plan: string; balance_cents: number; monthly_budget_cents: number; created_at: number }
    | undefined;
}

export function chargeBilling(brandId: string, amountCents: number, description: string, generationId?: string) {
  const acc = getBilling(brandId);
  if (!acc) return;
  db().prepare("UPDATE billing_accounts SET balance_cents = balance_cents - ? WHERE id = ?").run(amountCents, acc.id);
  db().prepare(`
    INSERT INTO transactions (id, account_id, kind, amount_cents, description, generation_id, created_at)
    VALUES (?, ?, 'charge', ?, ?, ?, ?)
  `).run(`txn_${nanoid(10)}`, acc.id, amountCents, description, generationId || null, nowMs());
}

export function creditBilling(brandId: string, amountCents: number, description: string) {
  const acc = getBilling(brandId);
  if (!acc) return;
  db().prepare("UPDATE billing_accounts SET balance_cents = balance_cents + ? WHERE id = ?").run(amountCents, acc.id);
  db().prepare(`
    INSERT INTO transactions (id, account_id, kind, amount_cents, description, generation_id, created_at)
    VALUES (?, ?, 'credit', ?, ?, NULL, ?)
  `).run(`txn_${nanoid(10)}`, acc.id, amountCents, description, nowMs());
}

// ---------- References ----------

export interface ReferenceRow {
  id: string;
  brand_id: string;
  kind: "upload" | "stock" | "generated";
  source: string;
  label: string | null;
  prompt: string | null;
  file_path: string | null;
  width: number | null;
  height: number | null;
  mime: string | null;
  palette: string | null;
  tags: string | null;
  selected: number;
  created_at: number;
}

export interface Reference extends Omit<ReferenceRow, "palette" | "tags"> {
  palette: string[];
  tags: string[];
}

export function listReferences(brandId: string): Reference[] {
  const rows = db().prepare("SELECT * FROM references_ WHERE brand_id = ? ORDER BY created_at DESC").all(brandId) as ReferenceRow[];
  return rows.map(hydrateRef);
}

export function getReference(id: string): Reference | null {
  const r = db().prepare("SELECT * FROM references_ WHERE id = ?").get(id) as ReferenceRow | undefined;
  return r ? hydrateRef(r) : null;
}

function hydrateRef(r: ReferenceRow): Reference {
  return { ...r, palette: r.palette ? JSON.parse(r.palette) : [], tags: r.tags ? JSON.parse(r.tags) : [] };
}

export function createReference(input: {
  brandId: string; kind: "upload" | "stock" | "generated"; source: string; label?: string; prompt?: string;
  filePath: string; width?: number; height?: number; mime?: string; palette?: string[]; tags?: string[];
}): Reference {
  const id = `ref_${nanoid(10)}`;
  db().prepare(`
    INSERT INTO references_ (id, brand_id, kind, source, label, prompt, file_path, width, height, mime, palette, tags, selected, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    id, input.brandId, input.kind, input.source, input.label || null, input.prompt || null,
    input.filePath, input.width || null, input.height || null, input.mime || null,
    JSON.stringify(input.palette || []), JSON.stringify(input.tags || []), nowMs(),
  );
  return getReference(id)!;
}

export function deleteReference(id: string) {
  db().prepare("DELETE FROM references_ WHERE id = ?").run(id);
}

export function toggleReferenceSelected(id: string, selected: boolean) {
  db().prepare("UPDATE references_ SET selected = ? WHERE id = ?").run(selected ? 1 : 0, id);
}

// ---------- Brand copy schema (Copy Sheet columns) ----------

export function getCopySchema(brandId: string): CopySchema {
  const row = db().prepare("SELECT copy_schema FROM brands WHERE id = ?").get(brandId) as { copy_schema: string | null } | undefined;
  return parseCopySchema(row?.copy_schema ? JSON.parse(row.copy_schema) : null);
}

export function setCopySchema(brandId: string, schema: CopySchema) {
  db().prepare("UPDATE brands SET copy_schema = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(schema), nowMs(), brandId);
}

// A project's columns inherit the brand default until the project overrides them.
export function getProjectCopySchema(campaignId: string): CopySchema {
  const row = db().prepare("SELECT brand_id, copy_schema FROM campaigns WHERE id = ?").get(campaignId) as { brand_id: string; copy_schema: string | null } | undefined;
  if (!row) return defaultCopySchema();
  if (row.copy_schema) return parseCopySchema(JSON.parse(row.copy_schema));
  return getCopySchema(row.brand_id);
}

export function setProjectCopySchema(campaignId: string, schema: CopySchema) {
  db().prepare("UPDATE campaigns SET copy_schema = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(schema), nowMs(), campaignId);
}

// ---------- Copy Sheet rows ----------

export interface CopyRow {
  id: string; campaign_id: string; brand_id: string;
  values: Record<string, string>; status: string; order_idx: number; created_at: number;
  generation_id: string | null;
}

function hydrateCopyRow(r: any): CopyRow {
  return { ...r, values: r.values_json ? JSON.parse(r.values_json) : {}, generation_id: r.generation_id ?? null };
}

export function listCopyRows(campaignId: string): CopyRow[] {
  return (db().prepare("SELECT * FROM copy_rows WHERE campaign_id = ? ORDER BY order_idx ASC, created_at ASC").all(campaignId) as any[]).map(hydrateCopyRow);
}

export function createCopyRow(campaignId: string, brandId: string, values: Record<string, string> = {}): CopyRow {
  const id = `crow_${nanoid(10)}`;
  const max = db().prepare("SELECT COALESCE(MAX(order_idx), -1) m FROM copy_rows WHERE campaign_id = ?").get(campaignId) as { m: number };
  db().prepare("INSERT INTO copy_rows (id, campaign_id, brand_id, values_json, status, order_idx, created_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)")
    .run(id, campaignId, brandId, JSON.stringify(values), max.m + 1, nowMs());
  return hydrateCopyRow(db().prepare("SELECT * FROM copy_rows WHERE id = ?").get(id));
}

export function updateCopyRow(id: string, patch: { values?: Record<string, string>; status?: string }) {
  const cur = db().prepare("SELECT * FROM copy_rows WHERE id = ?").get(id) as any;
  if (!cur) return;
  const values = patch.values ? JSON.stringify(patch.values) : cur.values_json;
  const status = patch.status ?? cur.status;
  db().prepare("UPDATE copy_rows SET values_json = ?, status = ? WHERE id = ?").run(values, status, id);
}

export function deleteCopyRow(id: string) {
  db().prepare("DELETE FROM copy_rows WHERE id = ?").run(id);
}

export function getCopyRow(id: string): CopyRow | null {
  const r = db().prepare("SELECT * FROM copy_rows WHERE id = ?").get(id) as any;
  return r ? hydrateCopyRow(r) : null;
}

// Link (or unlink, with null) a copy row to a specific creative.
export function linkCopyRow(id: string, generationId: string | null) {
  db().prepare("UPDATE copy_rows SET generation_id = ? WHERE id = ?").run(generationId, id);
}

// ---------- Comments & @mentions ----------

export interface CommentRow {
  id: string; brand_id: string | null; target_type: string; target_id: string;
  author_id: string; body: string; mentions: string[]; created_at: number;
  author: { name: string; email: string; color: string };
}

export function listComments(targetType: string, targetId: string): CommentRow[] {
  const rows = db().prepare(`
    SELECT c.*, u.name u_name, u.email u_email, u.avatar_color u_color
    FROM comments c LEFT JOIN users u ON u.id = c.author_id
    WHERE c.target_type = ? AND c.target_id = ?
    ORDER BY c.created_at ASC
  `).all(targetType, targetId) as any[];
  return rows.map((r) => ({
    id: r.id, brand_id: r.brand_id, target_type: r.target_type, target_id: r.target_id,
    author_id: r.author_id, body: r.body, mentions: r.mentions_json ? JSON.parse(r.mentions_json) : [], created_at: r.created_at,
    author: { name: r.u_name || "Someone", email: r.u_email || "", color: r.u_color || "#C9A45C" },
  }));
}

export function getComment(id: string): { id: string; brand_id: string | null; author_id: string } | null {
  return (db().prepare("SELECT id, brand_id, author_id FROM comments WHERE id = ?").get(id) as any) || null;
}

export function createComment(input: { brandId?: string | null; targetType: string; targetId: string; authorId: string; body: string; mentions?: string[] }): CommentRow {
  const id = `cmt_${nanoid(12)}`;
  db().prepare(`INSERT INTO comments (id, brand_id, target_type, target_id, author_id, body, mentions_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, input.brandId || null, input.targetType, input.targetId, input.authorId, input.body, JSON.stringify(input.mentions || []), nowMs());
  return listComments(input.targetType, input.targetId).find((c) => c.id === id)!;
}

export function deleteComment(id: string) {
  db().prepare("DELETE FROM comments WHERE id = ?").run(id);
}

// ---------- Brand assets (logo / icon / badge bank) ----------

export type AssetKind = "logo" | "mark" | "icon" | "badge" | "graphic";
export type AssetRole = "" | "primary" | "inverse";

export interface BrandAsset {
  id: string; brand_id: string; kind: AssetKind; role: AssetRole;
  label: string | null; file_path: string; mime: string;
  width: number | null; height: number | null; tags: string[]; created_at: number;
}

function hydrateAsset(row: any): BrandAsset {
  return { ...row, tags: row.tags ? JSON.parse(row.tags) : [] };
}

export function listAssets(brandId: string): BrandAsset[] {
  return (db().prepare("SELECT * FROM brand_assets WHERE brand_id = ? ORDER BY created_at DESC").all(brandId) as any[]).map(hydrateAsset);
}

export function getAsset(id: string): BrandAsset | null {
  const r = db().prepare("SELECT * FROM brand_assets WHERE id = ?").get(id) as any;
  return r ? hydrateAsset(r) : null;
}

export function createAsset(input: {
  brandId: string; kind: AssetKind; role?: AssetRole; label?: string;
  filePath: string; mime: string; width?: number; height?: number; tags?: string[];
}): BrandAsset {
  const id = `asset_${nanoid(10)}`;
  db().prepare(`
    INSERT INTO brand_assets (id, brand_id, kind, role, label, file_path, mime, width, height, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.brandId, input.kind, input.role || "", input.label || null,
    input.filePath, input.mime, input.width || null, input.height || null,
    JSON.stringify(input.tags || []), nowMs(),
  );
  return getAsset(id)!;
}

export function deleteAsset(id: string) {
  db().prepare("DELETE FROM brand_assets WHERE id = ?").run(id);
}

// Designate the primary or inverse locker logo — only one of each per brand.
export function setAssetRole(id: string, role: AssetRole) {
  const asset = getAsset(id);
  if (!asset) return;
  if (role === "primary" || role === "inverse") {
    db().prepare("UPDATE brand_assets SET role = '' WHERE brand_id = ? AND role = ?").run(asset.brand_id, role);
  }
  db().prepare("UPDATE brand_assets SET role = ? WHERE id = ?").run(role, id);
}

// The logo to composite in the locker. variant 'inverse' is the light/knockout
// logo for dark backgrounds; falls back to the primary when no inverse exists.
export function getLockerLogo(brandId: string, variant: "primary" | "inverse" = "primary"): BrandAsset | null {
  if (variant === "inverse") {
    const inv = db().prepare("SELECT * FROM brand_assets WHERE brand_id = ? AND role = 'inverse'").get(brandId) as any;
    if (inv) return hydrateAsset(inv);
  }
  const primary = db().prepare("SELECT * FROM brand_assets WHERE brand_id = ? AND role = 'primary'").get(brandId) as any;
  return primary ? hydrateAsset(primary) : null;
}

// ---------- Copy variants ----------

export interface CopyVariantRow {
  id: string;
  idea_id: string;
  headline: string;
  subhead: string | null;
  cta: string | null;
  eyebrow: string | null;
  note: string | null;
  starred: number;
  source: string;
  created_at: number;
}

export function listCopyVariants(ideaId: string): CopyVariantRow[] {
  return db().prepare("SELECT * FROM copy_variants WHERE idea_id = ? ORDER BY starred DESC, created_at DESC").all(ideaId) as CopyVariantRow[];
}

export function createCopyVariant(input: {
  ideaId: string; headline: string; subhead?: string; cta?: string; eyebrow?: string; note?: string; source?: string;
}): CopyVariantRow {
  const id = `cv_${nanoid(10)}`;
  db().prepare(`
    INSERT INTO copy_variants (id, idea_id, headline, subhead, cta, eyebrow, note, starred, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    id, input.ideaId, input.headline, input.subhead || null, input.cta || null, input.eyebrow || null,
    input.note || null, input.source || "ai", nowMs(),
  );
  return db().prepare("SELECT * FROM copy_variants WHERE id = ?").get(id) as CopyVariantRow;
}

export function starCopyVariant(id: string, starred: boolean) {
  db().prepare("UPDATE copy_variants SET starred = ? WHERE id = ?").run(starred ? 1 : 0, id);
}

export function deleteCopyVariant(id: string) {
  db().prepare("DELETE FROM copy_variants WHERE id = ?").run(id);
}

// ---------- Campaign format labels ----------

export interface CampaignFormatRow {
  id: string;
  campaign_id: string;
  format_slug: string;
  label: string | null;
  width_override: number | null;
  height_override: number | null;
}

export function listCampaignFormats(campaignId: string): CampaignFormatRow[] {
  return db().prepare("SELECT * FROM campaign_formats WHERE campaign_id = ?").all(campaignId) as CampaignFormatRow[];
}

export function upsertCampaignFormat(input: {
  campaignId: string; formatSlug: string; label?: string | null; width?: number | null; height?: number | null;
}): void {
  const existing = db().prepare("SELECT id FROM campaign_formats WHERE campaign_id = ? AND format_slug = ?").get(input.campaignId, input.formatSlug) as { id: string } | undefined;
  if (existing) {
    db().prepare("UPDATE campaign_formats SET label = ?, width_override = ?, height_override = ? WHERE id = ?").run(
      input.label ?? null, input.width ?? null, input.height ?? null, existing.id,
    );
  } else {
    db().prepare(`
      INSERT INTO campaign_formats (id, campaign_id, format_slug, label, width_override, height_override)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(`cf_${nanoid(8)}`, input.campaignId, input.formatSlug, input.label ?? null, input.width ?? null, input.height ?? null);
  }
}

// ---------- Anchors (approved + winners + starred) feed agents ----------

export interface AnchorCopy {
  source: "approved" | "winner" | "starred";
  eyebrow?: string;
  headline: string;
  subhead?: string;
  cta?: string;
  metric_label?: string;
  format_slug?: string;
}

export function listAnchorCopy(brandId: string, limit = 10): AnchorCopy[] {
  const out: AnchorCopy[] = [];
  const winners = db().prepare(`
    SELECT eyebrow, headline, subhead, cta, format_slug, metric_label
    FROM external_winners WHERE brand_id = ? AND is_winner = 1
    ORDER BY created_at DESC LIMIT ?
  `).all(brandId, limit) as any[];
  for (const w of winners) out.push({ source: "winner", ...w });

  const perfWinners = db().prepare(`
    SELECT eyebrow, headline, subhead, cta, format_slug
    FROM generations WHERE brand_id = ? AND is_winner = 1
    ORDER BY updated_at DESC LIMIT ?
  `).all(brandId, limit) as any[];
  for (const g of perfWinners) {
    if (!out.some((a) => a.headline === g.headline)) out.push({ source: "winner", ...g });
  }

  const approved = db().prepare(`
    SELECT eyebrow, headline, subhead, cta, format_slug
    FROM generations WHERE brand_id = ? AND status = 'approved'
    ORDER BY updated_at DESC LIMIT ?
  `).all(brandId, limit) as any[];
  for (const g of approved) {
    if (!out.some((a) => a.headline === g.headline)) out.push({ source: "approved", ...g });
  }

  const starred = db().prepare(`
    SELECT cv.eyebrow, cv.headline, cv.subhead, cv.cta
    FROM copy_variants cv
    JOIN ideas i ON i.id = cv.idea_id
    JOIN campaigns c ON c.id = i.campaign_id
    WHERE c.brand_id = ? AND cv.starred = 1
    ORDER BY cv.created_at DESC LIMIT ?
  `).all(brandId, limit) as any[];
  for (const s of starred) {
    if (!out.some((a) => a.headline === s.headline)) out.push({ source: "starred", ...s });
  }

  return out.slice(0, limit);
}

// ---------- External winners ----------

export interface ExternalWinnerRow {
  id: string; brand_id: string; label: string | null; format_slug: string | null;
  eyebrow: string | null; headline: string; subhead: string | null; cta: string | null;
  source: string | null; notes: string | null; metric_label: string | null;
  is_winner: number; created_at: number;
}

export function listExternalWinners(brandId: string): ExternalWinnerRow[] {
  return db().prepare("SELECT * FROM external_winners WHERE brand_id = ? ORDER BY created_at DESC").all(brandId) as ExternalWinnerRow[];
}

export function createExternalWinner(input: {
  brandId: string; label?: string; formatSlug?: string;
  eyebrow?: string; headline: string; subhead?: string; cta?: string;
  source?: string; notes?: string; metricLabel?: string;
}): ExternalWinnerRow {
  const id = `winr_${nanoid(10)}`;
  db().prepare(`
    INSERT INTO external_winners (id, brand_id, label, format_slug, eyebrow, headline, subhead, cta, source, notes, metric_label, is_winner, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    id, input.brandId, input.label || null, input.formatSlug || null,
    input.eyebrow || null, input.headline, input.subhead || null, input.cta || null,
    input.source || "manual", input.notes || null, input.metricLabel || null, nowMs(),
  );
  return db().prepare("SELECT * FROM external_winners WHERE id = ?").get(id) as ExternalWinnerRow;
}

export function deleteExternalWinner(id: string) {
  db().prepare("DELETE FROM external_winners WHERE id = ?").run(id);
}

export function setGenerationWinner(id: string, isWinner: boolean) {
  db().prepare("UPDATE generations SET is_winner = ?, updated_at = ? WHERE id = ?").run(isWinner ? 1 : 0, nowMs(), id);
}

// ---------- Performance ingestion ----------

export function recordPerformance(input: {
  generationId: string; source: string;
  impressions?: number; clicks?: number; ctr?: number; conversions?: number;
  spendCents?: number; roas?: number; isWinner?: boolean; notes?: string;
  periodStart?: number; periodEnd?: number;
}) {
  const id = `perf_${nanoid(10)}`;
  db().prepare(`
    INSERT INTO asset_performance (id, generation_id, source, period_start, period_end, impressions, clicks, ctr, conversions, spend_cents, roas, is_winner, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, input.generationId, input.source,
    input.periodStart || null, input.periodEnd || null,
    input.impressions ?? null, input.clicks ?? null, input.ctr ?? null, input.conversions ?? null,
    input.spendCents ?? null, input.roas ?? null,
    input.isWinner ? 1 : 0, input.notes || null, nowMs(),
  );
  if (input.isWinner) setGenerationWinner(input.generationId, true);
}

// ---------- Rule proposals ----------

export interface RuleProposalRow {
  id: string; brand_id: string; kind: "do" | "dont" | "preferred" | "banned";
  rule: string; evidence: string | null;
  status: "pending" | "accepted" | "dismissed"; created_at: number;
}

export function listRuleProposals(brandId: string, status?: "pending" | "accepted" | "dismissed"): RuleProposalRow[] {
  const sql = status
    ? "SELECT * FROM rule_proposals WHERE brand_id = ? AND status = ? ORDER BY created_at DESC"
    : "SELECT * FROM rule_proposals WHERE brand_id = ? ORDER BY created_at DESC";
  const args = status ? [brandId, status] : [brandId];
  return db().prepare(sql).all(...args) as RuleProposalRow[];
}

export function createRuleProposal(input: { brandId: string; kind: "do" | "dont" | "preferred" | "banned"; rule: string; evidence?: string }) {
  const id = `rp_${nanoid(10)}`;
  db().prepare(`
    INSERT INTO rule_proposals (id, brand_id, kind, rule, evidence, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, input.brandId, input.kind, input.rule, input.evidence || null, nowMs());
}

export function getRuleProposal(id: string): RuleProposalRow | null {
  return (db().prepare("SELECT * FROM rule_proposals WHERE id = ?").get(id) as RuleProposalRow) || null;
}

export function updateRuleProposalStatus(id: string, status: "accepted" | "dismissed") {
  db().prepare("UPDATE rule_proposals SET status = ? WHERE id = ?").run(status, id);
}

export function clearPendingProposals(brandId: string) {
  db().prepare("UPDATE rule_proposals SET status = 'dismissed' WHERE brand_id = ? AND status = 'pending'").run(brandId);
}

export function collectReviewerNotes(brandId: string, limit = 80): Array<{ note: string; verdict: string; format_slug: string; headline: string }> {
  return db().prepare(`
    SELECT r.note as note, r.action as verdict, g.format_slug as format_slug, g.headline as headline
    FROM reviews r
    JOIN generations g ON g.id = r.generation_id
    WHERE g.brand_id = ? AND r.note IS NOT NULL AND r.note != ''
    ORDER BY r.created_at DESC LIMIT ?
  `).all(brandId, limit) as any;
}

export function listTransactions(brandId: string, limit = 50) {
  const acc = getBilling(brandId);
  if (!acc) return [];
  return db().prepare("SELECT * FROM transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT ?").all(acc.id, limit) as Array<{
    id: string; account_id: string; kind: string; amount_cents: number; description: string | null; generation_id: string | null; created_at: number;
  }>;
}
