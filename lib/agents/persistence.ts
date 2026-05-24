import { db, nowMs } from "@/lib/db";
import { nanoid } from "nanoid";
import type { AgentKind, AgentProvider, AgentRunRow } from "./types";
import { computeCostMicros, type UsageNumbers } from "./pricing";
import { recordSpend, type SpendProvider } from "@/lib/spend";

export interface AgentUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export function newChainId(): string {
  return `chain_${nanoid(10)}`;
}

export async function recordRun<I, O>(opts: {
  kind: AgentKind;
  chainId?: string;
  parentRunId?: string;
  brandId?: string;
  campaignId?: string;
  ideaId?: string;
  generationId?: string;
  userId?: string;
  provider: AgentProvider;
  input: I;
  fn: () => Promise<{ output: O; rationale: string; usage?: AgentUsage }>;
}): Promise<{ runId: string; output: O; rationale: string }> {
  const id = `run_${nanoid(12)}`;
  const startedAt = nowMs();
  db().prepare(`
    INSERT INTO agent_runs (
      id, kind, chain_id, parent_run_id, brand_id, campaign_id, idea_id, generation_id,
      status, input_json, provider, model, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, ?)
  `).run(
    id, opts.kind, opts.chainId || null, opts.parentRunId || null,
    opts.brandId || null, opts.campaignId || null, opts.ideaId || null, opts.generationId || null,
    JSON.stringify(opts.input),
    opts.provider.name, opts.provider.model, startedAt,
  );

  try {
    const result = await opts.fn();
    const duration = nowMs() - startedAt;
    const u: UsageNumbers = {
      input_tokens: result.usage?.input_tokens || 0,
      output_tokens: result.usage?.output_tokens || 0,
      cache_creation_input_tokens: result.usage?.cache_creation_input_tokens || 0,
      cache_read_input_tokens: result.usage?.cache_read_input_tokens || 0,
    };
    const isReal = opts.provider.name !== "mock";
    const costMicros = isReal ? computeCostMicros(u) : 0;
    db().prepare(`
      UPDATE agent_runs
      SET status = 'ok', output_json = ?, rationale = ?, duration_ms = ?,
          tokens_in = ?, tokens_out = ?, cache_create_tokens = ?, cache_read_tokens = ?, cost_micros = ?
      WHERE id = ?
    `).run(
      JSON.stringify(result.output), result.rationale, duration,
      u.input_tokens, u.output_tokens, u.cache_creation_input_tokens, u.cache_read_input_tokens, costMicros,
      id,
    );
    // Mirror real reasoning cost into the unified spend ledger.
    if (isReal && costMicros > 0) {
      recordSpend({
        userId: opts.userId, brandId: opts.brandId, campaignId: opts.campaignId,
        generationId: opts.generationId, runId: id,
        provider: opts.provider.name as SpendProvider, category: "reasoning",
        model: opts.provider.model, costMicros,
      });
    }
    return { runId: id, output: result.output, rationale: result.rationale };
  } catch (e: any) {
    const duration = nowMs() - startedAt;
    db().prepare(`UPDATE agent_runs SET status = 'failed', error = ?, duration_ms = ? WHERE id = ?`).run(
      e?.message || String(e), duration, id,
    );
    throw e;
  }
}

export function listAgentRuns(filters: { campaignId?: string; chainId?: string; kind?: AgentKind } = {}, limit = 200): AgentRunRow[] {
  const where: string[] = [];
  const args: any[] = [];
  if (filters.campaignId) { where.push("campaign_id = ?"); args.push(filters.campaignId); }
  if (filters.chainId) { where.push("chain_id = ?"); args.push(filters.chainId); }
  if (filters.kind) { where.push("kind = ?"); args.push(filters.kind); }
  const sql = `SELECT * FROM agent_runs ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ?`;
  args.push(limit);
  return db().prepare(sql).all(...args) as AgentRunRow[];
}

export function getAgentRun(id: string): AgentRunRow | null {
  return (db().prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as AgentRunRow) || null;
}

export interface UsageRow {
  kind: AgentKind;
  provider: string;
  runs: number;
  tokens_in: number;
  tokens_out: number;
  cache_create: number;
  cache_read: number;
  cost_micros: number;
}

export interface UsageFilters {
  brandId?: string;
  since?: number;
}

export function usageBreakdown(filters: UsageFilters = {}): UsageRow[] {
  const where: string[] = ["status = 'ok'"];
  const args: any[] = [];
  if (filters.brandId) { where.push("brand_id = ?"); args.push(filters.brandId); }
  if (filters.since != null) { where.push("created_at >= ?"); args.push(filters.since); }
  const sql = `
    SELECT
      kind, provider,
      COUNT(*) as runs,
      COALESCE(SUM(tokens_in), 0) as tokens_in,
      COALESCE(SUM(tokens_out), 0) as tokens_out,
      COALESCE(SUM(cache_create_tokens), 0) as cache_create,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read,
      COALESCE(SUM(cost_micros), 0) as cost_micros
    FROM agent_runs
    WHERE ${where.join(" AND ")}
    GROUP BY kind, provider
    ORDER BY kind, provider
  `;
  return db().prepare(sql).all(...args) as UsageRow[];
}

export function usageTotals(filters: UsageFilters = {}): UsageRow {
  const rows = usageBreakdown(filters);
  return rows.reduce((agg, r) => ({
    kind: agg.kind, provider: "all",
    runs: agg.runs + r.runs,
    tokens_in: agg.tokens_in + r.tokens_in,
    tokens_out: agg.tokens_out + r.tokens_out,
    cache_create: agg.cache_create + r.cache_create,
    cache_read: agg.cache_read + r.cache_read,
    cost_micros: agg.cost_micros + r.cost_micros,
  }), { kind: "strategist" as AgentKind, provider: "all", runs: 0, tokens_in: 0, tokens_out: 0, cache_create: 0, cache_read: 0, cost_micros: 0 });
}

export function usagePerBrand(): Array<UsageRow & { brand_id: string }> {
  return db().prepare(`
    SELECT
      brand_id,
      kind, provider,
      COUNT(*) as runs,
      COALESCE(SUM(tokens_in), 0) as tokens_in,
      COALESCE(SUM(tokens_out), 0) as tokens_out,
      COALESCE(SUM(cache_create_tokens), 0) as cache_create,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read,
      COALESCE(SUM(cost_micros), 0) as cost_micros
    FROM agent_runs
    WHERE status = 'ok' AND brand_id IS NOT NULL
    GROUP BY brand_id
    ORDER BY cost_micros DESC
  `).all() as any;
}
