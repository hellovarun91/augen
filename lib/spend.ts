// Unified API spend ledger — the single source of truth for real COGS.
// Every real external call (Claude reasoning, Gemini image, Claude vision,
// Pexels stock) records one row here. The cost dashboard reads only this table.
import { db, nowMs } from "./db";
import { nanoid } from "nanoid";
import { getPricing } from "./agents/pricing";

export type SpendProvider = "claude" | "gemini" | "pexels";
export type SpendCategory = "reasoning" | "image" | "vision" | "stock";

export interface RecordSpendOpts {
  userId?: string | null;
  brandId?: string | null;
  campaignId?: string | null;
  generationId?: string | null;
  runId?: string | null;
  provider: SpendProvider;
  category: SpendCategory;
  model?: string | null;
  qty?: number;
  costMicros: number;
  meta?: Record<string, unknown>;
}

// Best-effort: never let cost bookkeeping break a user-facing action.
export function recordSpend(opts: RecordSpendOpts): void {
  try {
    db().prepare(`
      INSERT INTO api_spend (id, created_at, user_id, brand_id, campaign_id, generation_id, run_id, provider, category, model, qty, cost_micros, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `spend_${nanoid(12)}`, nowMs(),
      opts.userId || null, opts.brandId || null, opts.campaignId || null, opts.generationId || null, opts.runId || null,
      opts.provider, opts.category, opts.model || null,
      opts.qty ?? 1, Math.max(0, Math.round(opts.costMicros)),
      opts.meta ? JSON.stringify(opts.meta) : null,
    );
  } catch (e) {
    console.warn("[spend] failed to record:", (e as any)?.message || e);
  }
}

function sinceClause(since?: number): { where: string; args: any[] } {
  if (since == null) return { where: "", args: [] };
  return { where: "WHERE created_at >= ?", args: [since] };
}

export interface SpendTotals { cost_micros: number; events: number; }

export function spendTotals(since?: number): SpendTotals {
  const { where, args } = sinceClause(since);
  const r = db().prepare(`SELECT COALESCE(SUM(cost_micros),0) c, COUNT(*) n FROM api_spend ${where}`).get(...args) as any;
  return { cost_micros: r.c, events: r.n };
}

// Today's spend (local midnight → now), for the run-rate / "today" stat.
export function spendToday(): number {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const r = db().prepare(`SELECT COALESCE(SUM(cost_micros),0) c FROM api_spend WHERE created_at >= ?`).get(start.getTime()) as any;
  return r.c;
}

export interface CategoryRow { category: SpendCategory; provider: string; cost_micros: number; events: number; qty: number; }
export function spendByCategory(since?: number): CategoryRow[] {
  const { where, args } = sinceClause(since);
  return db().prepare(`
    SELECT category, provider, COALESCE(SUM(cost_micros),0) cost_micros, COUNT(*) events, COALESCE(SUM(qty),0) qty
    FROM api_spend ${where}
    GROUP BY category, provider
    ORDER BY cost_micros DESC
  `).all(...args) as any;
}

export interface BrandSpendRow { brand_id: string; cost_micros: number; events: number; }
export function spendByBrand(since?: number): BrandSpendRow[] {
  const { where, args } = sinceClause(since);
  const w = where ? `${where} AND brand_id IS NOT NULL` : "WHERE brand_id IS NOT NULL";
  return db().prepare(`
    SELECT brand_id, COALESCE(SUM(cost_micros),0) cost_micros, COUNT(*) events
    FROM api_spend ${w}
    GROUP BY brand_id ORDER BY cost_micros DESC
  `).all(...args) as any;
}

export interface CampaignSpendRow { campaign_id: string; cost_micros: number; events: number; }
export function spendByCampaign(opts: { brandId?: string; since?: number } = {}): CampaignSpendRow[] {
  const conds: string[] = ["campaign_id IS NOT NULL"];
  const args: any[] = [];
  if (opts.brandId) { conds.push("brand_id = ?"); args.push(opts.brandId); }
  if (opts.since != null) { conds.push("created_at >= ?"); args.push(opts.since); }
  return db().prepare(`
    SELECT campaign_id, COALESCE(SUM(cost_micros),0) cost_micros, COUNT(*) events
    FROM api_spend WHERE ${conds.join(" AND ")}
    GROUP BY campaign_id ORDER BY cost_micros DESC
  `).all(...args) as any;
}

export interface UserSpendRow { user_id: string; cost_micros: number; events: number; }
export function spendByUser(since?: number): UserSpendRow[] {
  const { where, args } = sinceClause(since);
  const w = where ? `${where} AND user_id IS NOT NULL` : "WHERE user_id IS NOT NULL";
  return db().prepare(`
    SELECT user_id, COALESCE(SUM(cost_micros),0) cost_micros, COUNT(*) events
    FROM api_spend ${w}
    GROUP BY user_id ORDER BY cost_micros DESC
  `).all(...args) as any;
}

// Creatives produced per brand — used for the cost-per-creative figure.
export function creativeCountByBrand(): Record<string, number> {
  const rows = db().prepare("SELECT brand_id, COUNT(*) n FROM generations GROUP BY brand_id").all() as any[];
  const m: Record<string, number> = {};
  for (const r of rows) m[r.brand_id] = r.n;
  return m;
}

// Dollars avoided by prompt caching: cache-read tokens billed at the cache-read
// rate instead of full input. Read from agent_runs (the token detail lives there).
export function cacheSavingsMicros(since?: number): number {
  const p = getPricing();
  const savedPerTok = (p.input - p.cacheRead) / 1e6; // $ saved per cached-read token
  const conds = ["cache_read_tokens > 0"];
  const args: any[] = [];
  if (since != null) { conds.push("created_at >= ?"); args.push(since); }
  const r = db().prepare(`SELECT COALESCE(SUM(cache_read_tokens),0) t FROM agent_runs WHERE ${conds.join(" AND ")}`).get(...args) as any;
  return Math.round((r.t || 0) * savedPerTok * 1e6);
}
