import { db, nowMs } from "@/lib/db";
import { nanoid } from "nanoid";
import type { AgentKind, AgentProvider, AgentRunRow } from "./types";

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
  provider: AgentProvider;
  input: I;
  fn: () => Promise<{ output: O; rationale: string; tokensIn?: number; tokensOut?: number }>;
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
    db().prepare(`
      UPDATE agent_runs
      SET status = 'ok', output_json = ?, rationale = ?, duration_ms = ?, tokens_in = ?, tokens_out = ?
      WHERE id = ?
    `).run(
      JSON.stringify(result.output), result.rationale, duration,
      result.tokensIn || null, result.tokensOut || null, id,
    );
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
