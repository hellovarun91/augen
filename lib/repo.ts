import { db, nowMs } from "./db";
import { nanoid } from "nanoid";
import { BrandLanguage, BrandTokens, type Brand, type BrandRow, type Campaign, type CampaignRow, type CampaignBrief, type Generation, type GenerationRow, type Idea, type IdeaRow } from "./types";

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

export function updateGenerationStatus(id: string, status: string, note?: string) {
  db().prepare("UPDATE generations SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?").run(
    status, note ?? null, nowMs(), id,
  );
  const rev = `rev_${nanoid(8)}`;
  db().prepare("INSERT INTO reviews (id, generation_id, action, note, reviewer, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    rev, id, status, note ?? null, "studio", nowMs(),
  );
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
