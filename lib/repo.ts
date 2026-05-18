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

export function listTransactions(brandId: string, limit = 50) {
  const acc = getBilling(brandId);
  if (!acc) return [];
  return db().prepare("SELECT * FROM transactions WHERE account_id = ? ORDER BY created_at DESC LIMIT ?").all(acc.id, limit) as Array<{
    id: string; account_id: string; kind: string; amount_cents: number; description: string | null; generation_id: string | null; created_at: number;
  }>;
}
