import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Resolves the data directory. AUGEN_DATA_DIR may be absolute (/data on Railway)
// or relative (defaults to "data" for local dev). Refs live at ${DATA_DIR}/refs.
export function dataDir(): string {
  const raw = process.env.AUGEN_DATA_DIR || "data";
  const abs = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
  return abs;
}

export function refsDir(): string {
  const abs = path.join(dataDir(), "refs");
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
  return abs;
}

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const filename = path.join(dataDir(), "augen.db");
  _db = new Database(filename);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

function migrate(d: Database.Database) {
  d.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#C9A45C',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    brand_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, brand_id)
  );

  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tagline TEXT,
    industry TEXT,
    description TEXT,
    voice TEXT,
    tokens TEXT NOT NULL,
    refs TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    schema TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quarter TEXT,
    year INTEGER,
    objective TEXT,
    audience TEXT,
    brief TEXT NOT NULL,
    template_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    theme TEXT NOT NULL,
    insight TEXT,
    angle TEXT NOT NULL,
    audience TEXT NOT NULL,
    promise TEXT,
    hooks TEXT,
    visual_direction TEXT,
    selected INTEGER NOT NULL DEFAULT 1,
    order_idx INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS formats (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    aspect TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    placement TEXT
  );

  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    idea_id TEXT REFERENCES ideas(id) ON DELETE SET NULL,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    format_slug TEXT NOT NULL,
    aspect TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    headline TEXT NOT NULL,
    subhead TEXT,
    cta TEXT NOT NULL,
    eyebrow TEXT,
    copy_json TEXT,
    image_prompt TEXT,
    image_seed INTEGER NOT NULL,
    image_style TEXT,
    palette TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review',
    confidence REAL NOT NULL DEFAULT 0.8,
    notes TEXT,
    cost_cents INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS gen_campaign_idx ON generations(campaign_id);
  CREATE INDEX IF NOT EXISTS gen_status_idx ON generations(status);

  CREATE TABLE IF NOT EXISTS billing_accounts (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'studio',
    balance_cents INTEGER NOT NULL DEFAULT 50000,
    monthly_budget_cents INTEGER NOT NULL DEFAULT 100000,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES billing_accounts(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    description TEXT,
    generation_id TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    note TEXT,
    reviewer TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS references_ (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,           -- 'upload' | 'stock' | 'generated'
    source TEXT NOT NULL,         -- provider name or 'upload'
    label TEXT,                    -- human label
    prompt TEXT,                   -- if generated
    file_path TEXT,                -- relative under public/refs/
    width INTEGER,
    height INTEGER,
    mime TEXT,
    palette TEXT,                  -- extracted dominant colors JSON
    tags TEXT,                     -- JSON array
    selected INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS refs_brand_idx ON references_(brand_id);

  CREATE TABLE IF NOT EXISTS campaign_formats (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    format_slug TEXT NOT NULL,
    label TEXT,                    -- per-campaign rename
    width_override INTEGER,
    height_override INTEGER,
    UNIQUE(campaign_id, format_slug)
  );

  CREATE TABLE IF NOT EXISTS copy_variants (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    headline TEXT NOT NULL,
    subhead TEXT,
    cta TEXT,
    eyebrow TEXT,
    note TEXT,
    starred INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'ai',  -- 'ai' | 'human' | 'edit'
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS cv_idea_idx ON copy_variants(idea_id);

  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    chain_id TEXT,
    parent_run_id TEXT,
    brand_id TEXT,
    campaign_id TEXT,
    idea_id TEXT,
    generation_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    input_json TEXT NOT NULL,
    output_json TEXT,
    rationale TEXT,
    provider TEXT NOT NULL DEFAULT 'mock',
    model TEXT,
    duration_ms INTEGER,
    tokens_in INTEGER,
    tokens_out INTEGER,
    error TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS ar_campaign_idx ON agent_runs(campaign_id);
  CREATE INDEX IF NOT EXISTS ar_chain_idx ON agent_runs(chain_id);
  CREATE INDEX IF NOT EXISTS ar_kind_idx ON agent_runs(kind);
  `);

  // Migrate old generations rows that lack the new ref column
  try { d.prepare("ALTER TABLE generations ADD COLUMN reference_id TEXT").run(); } catch {}
  try { d.prepare("ALTER TABLE generations ADD COLUMN format_label TEXT").run(); } catch {}
  try { d.prepare("ALTER TABLE generations ADD COLUMN width_override INTEGER").run(); } catch {}
  try { d.prepare("ALTER TABLE generations ADD COLUMN height_override INTEGER").run(); } catch {}
  try { d.prepare("ALTER TABLE brands ADD COLUMN language TEXT").run(); } catch {}
  try { d.prepare("ALTER TABLE brands ADD COLUMN figma_file_url TEXT").run(); } catch {}
  // Detailed usage tracking columns on agent_runs (additive — older rows have nulls)
  try { d.prepare("ALTER TABLE agent_runs ADD COLUMN cache_create_tokens INTEGER").run(); } catch {}
  try { d.prepare("ALTER TABLE agent_runs ADD COLUMN cache_read_tokens INTEGER").run(); } catch {}
  try { d.prepare("ALTER TABLE agent_runs ADD COLUMN cost_micros INTEGER").run(); } catch {} // USD * 1_000_000

  d.exec(`
  CREATE TABLE IF NOT EXISTS external_winners (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    label TEXT,
    format_slug TEXT,
    eyebrow TEXT,
    headline TEXT NOT NULL,
    subhead TEXT,
    cta TEXT,
    source TEXT,
    notes TEXT,
    metric_label TEXT,
    is_winner INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ew_brand_idx ON external_winners(brand_id);

  CREATE TABLE IF NOT EXISTS asset_performance (
    id TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    period_start INTEGER,
    period_end INTEGER,
    impressions INTEGER,
    clicks INTEGER,
    ctr REAL,
    conversions INTEGER,
    spend_cents INTEGER,
    roas REAL,
    is_winner INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS perf_gen_idx ON asset_performance(generation_id);

  CREATE TABLE IF NOT EXISTS rule_proposals (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    rule TEXT NOT NULL,
    evidence TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS rp_brand_idx ON rule_proposals(brand_id);
  `);

  try { d.prepare("ALTER TABLE generations ADD COLUMN is_winner INTEGER NOT NULL DEFAULT 0").run(); } catch {}
  try { d.prepare("ALTER TABLE generations ADD COLUMN overrides_json TEXT").run(); } catch {}

  d.exec(`
  CREATE TABLE IF NOT EXISTS user_credits (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'trial',
    balance INTEGER NOT NULL DEFAULT 0,
    monthly_grant INTEGER NOT NULL DEFAULT 0,
    period_start INTEGER NOT NULL,
    period_end INTEGER NOT NULL,
    lifetime_used INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    ref_kind TEXT,
    ref_id TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ct_user_idx ON credit_transactions(user_id);
  CREATE INDEX IF NOT EXISTS ct_kind_idx ON credit_transactions(kind);

  CREATE TABLE IF NOT EXISTS variation_batches (
    id TEXT PRIMARY KEY,
    idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    strategy TEXT NOT NULL,
    slots_json TEXT NOT NULL,
    formats_json TEXT NOT NULL,
    generations_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS vb_idea_idx ON variation_batches(idea_id);
  CREATE INDEX IF NOT EXISTS vb_campaign_idx ON variation_batches(campaign_id);
  `);

  try { d.prepare("ALTER TABLE generations ADD COLUMN variation_batch_id TEXT").run(); } catch {}
  try { d.prepare("ALTER TABLE generations ADD COLUMN variation_row_json TEXT").run(); } catch {}

  d.exec(`
  CREATE TABLE IF NOT EXISTS feature_flags (
    name TEXT PRIMARY KEY,
    description TEXT,
    enabled_globally INTEGER NOT NULL DEFAULT 0,
    default_on_for_admins INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feature_flag_user_overrides (
    flag_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (flag_name, user_id)
  );

  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_user_id TEXT,
    target_brand_id TEXT,
    payload_json TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS aal_admin_idx ON admin_audit_log(admin_user_id);
  CREATE INDEX IF NOT EXISTS aal_target_idx ON admin_audit_log(target_user_id);
  CREATE INDEX IF NOT EXISTS aal_created_idx ON admin_audit_log(created_at);
  `);

  try { d.prepare("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'").run(); } catch {}
  try { d.prepare("ALTER TABLE users ADD COLUMN last_seen_at INTEGER").run(); } catch {}

  d.exec(`
  CREATE TABLE IF NOT EXISTS allowed_emails (
    email TEXT PRIMARY KEY,
    added_by_user_id TEXT,
    added_at INTEGER NOT NULL,
    note TEXT
  );
  `);

  // One-time path rewrite: pre-volume references stored as "/refs/<file>".
  // Move them to "/api/refs/<file>" so the new route serves them.
  try {
    d.prepare("UPDATE references_ SET file_path = '/api/refs/' || SUBSTR(file_path, 7) WHERE file_path LIKE '/refs/%'").run();
  } catch {}

  // Unified API spend ledger — every real external call (Claude reasoning,
  // Gemini image, Claude vision, Pexels stock) writes one row of true COGS.
  d.exec(`
  CREATE TABLE IF NOT EXISTS api_spend (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    user_id TEXT,
    brand_id TEXT,
    campaign_id TEXT,
    generation_id TEXT,
    run_id TEXT,
    provider TEXT NOT NULL,    -- claude | gemini | pexels
    category TEXT NOT NULL,    -- reasoning | image | vision | stock
    model TEXT,
    qty INTEGER NOT NULL DEFAULT 1,
    cost_micros INTEGER NOT NULL DEFAULT 0,
    meta_json TEXT
  );
  CREATE INDEX IF NOT EXISTS spend_created_idx ON api_spend(created_at);
  CREATE INDEX IF NOT EXISTS spend_brand_idx ON api_spend(brand_id);
  CREATE INDEX IF NOT EXISTS spend_campaign_idx ON api_spend(campaign_id);
  CREATE INDEX IF NOT EXISTS spend_user_idx ON api_spend(user_id);
  CREATE INDEX IF NOT EXISTS spend_run_idx ON api_spend(run_id);
  `);

  // Idempotent backfill: seed the ledger from historical agent_runs that already
  // carry real cost. Skips runs already represented (by run_id), so it's safe on
  // every boot and never double-counts ongoing recordSpend writes.
  try {
    d.prepare(`
      INSERT INTO api_spend (id, created_at, brand_id, campaign_id, generation_id, run_id, provider, category, model, qty, cost_micros)
      SELECT 'spend_run_' || ar.id, ar.created_at, ar.brand_id, ar.campaign_id, ar.generation_id, ar.id,
             ar.provider, 'reasoning', ar.model, 1, ar.cost_micros
      FROM agent_runs ar
      WHERE ar.cost_micros > 0 AND ar.provider != 'mock'
        AND NOT EXISTS (SELECT 1 FROM api_spend s WHERE s.run_id = ar.id)
    `).run();
  } catch {}

  // Brand asset bank — reusable brand graphics composited as-is (logo, mark,
  // icon, badge, graphic). Distinct from references_ (photographic conditioning).
  d.exec(`
  CREATE TABLE IF NOT EXISTS brand_assets (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,           -- logo | mark | icon | badge | graphic
    role TEXT NOT NULL DEFAULT '', -- '' | primary | inverse (locker logo designation)
    label TEXT,
    file_path TEXT NOT NULL,       -- /api/refs/<file>
    mime TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    tags TEXT,                     -- JSON array
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS brand_assets_brand_idx ON brand_assets(brand_id);
  `);
}

export function nowMs() {
  return Date.now();
}
