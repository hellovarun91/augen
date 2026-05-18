import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const filename = path.join(DATA_DIR, "augen.db");
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
  `);

  // Migrate old generations rows that lack the new ref column
  try { d.prepare("ALTER TABLE generations ADD COLUMN reference_id TEXT").run(); } catch {}
  try { d.prepare("ALTER TABLE generations ADD COLUMN format_label TEXT").run(); } catch {}
  try { d.prepare("ALTER TABLE generations ADD COLUMN width_override INTEGER").run(); } catch {}
  try { d.prepare("ALTER TABLE generations ADD COLUMN height_override INTEGER").run(); } catch {}
  try { d.prepare("ALTER TABLE brands ADD COLUMN language TEXT").run(); } catch {}
}

export function nowMs() {
  return Date.now();
}
