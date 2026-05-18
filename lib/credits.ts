import { db, nowMs } from "./db";
import { nanoid } from "nanoid";
import { TIERS, type Tier, type TierDef } from "./tiers";

export { TIERS };
export type { Tier, TierDef };

// Price of each action in credits. 1 credit ≈ $0.02 retail.
// Tuned so a Claude-only ad costs ~5 credits (~$0.10 retail vs ~$0.04 raw cost = ~150% markup).
export const PRICING = {
  generate_ad_claude: numEnv("AUGEN_PRICE_AD_CLAUDE", 5),       // per generation
  generate_ad_image: numEnv("AUGEN_PRICE_AD_IMAGE", 5),         // additional if Gemini image
  strategist: numEnv("AUGEN_PRICE_STRATEGIST", 3),
  spin_variants: numEnv("AUGEN_PRICE_SPIN_VARIANTS", 2),
  rule_refiner: numEnv("AUGEN_PRICE_RULE_REFINER", 3),
  token_extract: numEnv("AUGEN_PRICE_TOKEN_EXTRACT", 5),
  stock_search: numEnv("AUGEN_PRICE_STOCK_SEARCH", 1),
  image_generate: numEnv("AUGEN_PRICE_IMAGE_GENERATE", 8),
  critic_preview: numEnv("AUGEN_PRICE_CRITIC_PREVIEW", 1),
};

export type ActionKind = keyof typeof PRICING;

export interface CreditsRow {
  user_id: string;
  tier: Tier;
  balance: number;
  monthly_grant: number;
  period_start: number;
  period_end: number;
  lifetime_used: number;
}

function defaultPeriod(): { start: number; end: number } {
  const start = Date.now();
  const end = start + 30 * 86400_000;
  return { start, end };
}

export function ensureCredits(userId: string): CreditsRow {
  const existing = db().prepare("SELECT * FROM user_credits WHERE user_id = ?").get(userId) as CreditsRow | undefined;
  if (existing) return maybeRollOver(existing);
  const tier: Tier = "trial";
  const grant = TIERS[tier].monthlyGrant;
  const { start, end } = defaultPeriod();
  db().prepare(`
    INSERT INTO user_credits (user_id, tier, balance, monthly_grant, period_start, period_end, lifetime_used)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(userId, tier, grant, grant, start, end);
  db().prepare(`
    INSERT INTO credit_transactions (id, user_id, kind, amount, description, ref_kind, ref_id, created_at)
    VALUES (?, ?, 'grant', ?, ?, 'tier:trial', NULL, ?)
  `).run(`ctxn_${nanoid(10)}`, userId, grant, "Initial trial grant", nowMs());
  return db().prepare("SELECT * FROM user_credits WHERE user_id = ?").get(userId) as CreditsRow;
}

function maybeRollOver(row: CreditsRow): CreditsRow {
  const def = TIERS[row.tier];
  if (!def.resetsMonthly) return row;
  if (Date.now() < row.period_end) return row;
  // Reset for next period.
  const { start, end } = defaultPeriod();
  db().prepare(`
    UPDATE user_credits
    SET balance = ?, monthly_grant = ?, period_start = ?, period_end = ?
    WHERE user_id = ?
  `).run(def.monthlyGrant, def.monthlyGrant, start, end, row.user_id);
  db().prepare(`
    INSERT INTO credit_transactions (id, user_id, kind, amount, description, ref_kind, ref_id, created_at)
    VALUES (?, ?, 'grant', ?, ?, ?, NULL, ?)
  `).run(`ctxn_${nanoid(10)}`, row.user_id, def.monthlyGrant, "Monthly grant", `tier:${row.tier}`, nowMs());
  return db().prepare("SELECT * FROM user_credits WHERE user_id = ?").get(row.user_id) as CreditsRow;
}

export interface ChargeOpts {
  userId: string;
  action: ActionKind;
  units?: number;          // multiplier, default 1
  description?: string;
  refId?: string;
}

export function quoteCost(action: ActionKind, units = 1): number {
  return PRICING[action] * units;
}

export function getBalance(userId: string): number {
  const row = ensureCredits(userId);
  return row.balance;
}

export function chargeCredits(opts: ChargeOpts): { charged: number; balance: number } {
  const cost = quoteCost(opts.action, opts.units || 1);
  const row = ensureCredits(opts.userId);
  if (row.balance < cost) {
    const err = new Error(`Insufficient credits: ${opts.action} costs ${cost}, balance ${row.balance}.`);
    (err as any).code = "INSUFFICIENT_CREDITS";
    (err as any).need = cost;
    (err as any).have = row.balance;
    throw err;
  }
  const newBal = row.balance - cost;
  db().prepare("UPDATE user_credits SET balance = ?, lifetime_used = lifetime_used + ? WHERE user_id = ?").run(newBal, cost, opts.userId);
  db().prepare(`
    INSERT INTO credit_transactions (id, user_id, kind, amount, description, ref_kind, ref_id, created_at)
    VALUES (?, ?, 'charge', ?, ?, ?, ?, ?)
  `).run(`ctxn_${nanoid(10)}`, opts.userId, -cost, opts.description || opts.action, opts.action, opts.refId || null, nowMs());
  return { charged: cost, balance: newBal };
}

export function refundCredits(userId: string, amount: number, description?: string) {
  if (amount <= 0) return;
  db().prepare("UPDATE user_credits SET balance = balance + ?, lifetime_used = MAX(0, lifetime_used - ?) WHERE user_id = ?").run(amount, amount, userId);
  db().prepare(`
    INSERT INTO credit_transactions (id, user_id, kind, amount, description, ref_kind, ref_id, created_at)
    VALUES (?, ?, 'refund', ?, ?, 'refund', NULL, ?)
  `).run(`ctxn_${nanoid(10)}`, userId, amount, description || "Refund", nowMs());
}

export function topUp(userId: string, amount: number, description = "Top-up (mock)") {
  ensureCredits(userId);
  db().prepare("UPDATE user_credits SET balance = balance + ? WHERE user_id = ?").run(amount, userId);
  db().prepare(`
    INSERT INTO credit_transactions (id, user_id, kind, amount, description, ref_kind, ref_id, created_at)
    VALUES (?, ?, 'topup', ?, ?, 'manual', NULL, ?)
  `).run(`ctxn_${nanoid(10)}`, userId, amount, description, nowMs());
}

export function changeTier(userId: string, tier: Tier) {
  const def = TIERS[tier];
  const row = ensureCredits(userId);
  // Add the difference between new monthly grant and current grant — fresh slate effectively.
  const topUpAmount = Math.max(0, def.monthlyGrant - row.balance);
  db().prepare("UPDATE user_credits SET tier = ?, monthly_grant = ?, balance = MAX(balance, ?) WHERE user_id = ?").run(
    tier, def.monthlyGrant, def.monthlyGrant, userId,
  );
  if (topUpAmount > 0) {
    db().prepare(`
      INSERT INTO credit_transactions (id, user_id, kind, amount, description, ref_kind, ref_id, created_at)
      VALUES (?, ?, 'grant', ?, ?, ?, NULL, ?)
    `).run(`ctxn_${nanoid(10)}`, userId, topUpAmount, `Upgrade to ${def.label}`, `tier:${tier}`, nowMs());
  }
}

export function listCreditTxns(userId: string, limit = 30) {
  return db().prepare("SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit) as Array<{
    id: string; user_id: string; kind: string; amount: number; description: string | null; ref_kind: string | null; ref_id: string | null; created_at: number;
  }>;
}

function numEnv(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}
