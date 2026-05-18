// Lightweight in-memory token bucket. Per-process. Resets on restart (acceptable for v1).
// For multi-process / horizontal scale, swap to Redis or Upstash later.

interface BucketState {
  tokens: number;
  refillRatePerMs: number;
  capacity: number;
  lastRefill: number;
}

const buckets = new Map<string, BucketState>();

export interface RateLimitOpts {
  perMinute?: number;     // default 10
  burst?: number;         // bucket capacity; default = perMinute
}

export async function rateLimit(userId: string, action: string, opts: RateLimitOpts = {}) {
  const perMin = opts.perMinute ?? 10;
  const capacity = opts.burst ?? perMin;
  const refillPerMs = perMin / 60_000;
  const key = `${userId}:${action}`;
  const now = Date.now();
  const s = buckets.get(key);
  if (!s) {
    buckets.set(key, { tokens: capacity - 1, refillRatePerMs: refillPerMs, capacity, lastRefill: now });
    return;
  }
  const elapsed = now - s.lastRefill;
  s.tokens = Math.min(s.capacity, s.tokens + elapsed * s.refillRatePerMs);
  s.lastRefill = now;
  if (s.tokens < 1) {
    const waitMs = Math.ceil((1 - s.tokens) / s.refillRatePerMs);
    const seconds = Math.ceil(waitMs / 1000);
    const err = new Error(`Rate limit: ${action} limit ${perMin}/min. Try again in ${seconds}s.`);
    (err as any).code = "RATE_LIMITED";
    (err as any).retryAfterMs = waitMs;
    throw err;
  }
  s.tokens -= 1;
}

export function rateLimitStatus(userId: string, action: string): { remaining: number; capacity: number } | null {
  const s = buckets.get(`${userId}:${action}`);
  if (!s) return null;
  return { remaining: Math.floor(s.tokens), capacity: s.capacity };
}

// Hard cap check: refuse Claude calls past ANTHROPIC_BUDGET_USD by computing usage from agent_runs.
// Called from the agent path before invoking real Claude.
export function withinClaudeBudget(): { allowed: boolean; spentUsd?: number; budgetUsd?: number } {
  const raw = process.env.ANTHROPIC_BUDGET_USD;
  if (!raw) return { allowed: true };
  const budget = parseFloat(raw);
  if (!Number.isFinite(budget) || budget <= 0) return { allowed: true };
  // Lazy import to avoid a circular dep with persistence at module load.
  const { usageTotals } = require("./agents/persistence");
  const since = Date.now() - 30 * 86400_000;
  const totals = usageTotals({ since });
  const spent = totals.cost_micros / 1e6;
  return { allowed: spent < budget, spentUsd: spent, budgetUsd: budget };
}
