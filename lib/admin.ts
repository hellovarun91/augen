import { db, nowMs } from "./db";
import { nanoid } from "nanoid";
import { getCurrentUser, type UserRow } from "./users";

export function adminEmails(): string[] {
  const raw = process.env.AUGEN_ADMIN_EMAILS;
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email: string): boolean {
  const list = adminEmails();
  if (!list.length) return false;
  return list.includes(email.toLowerCase());
}

export function isAdmin(user: { email: string } | null | undefined): boolean {
  if (!user) return false;
  return isAdminEmail(user.email);
}

export async function requireAdmin(): Promise<UserRow> {
  const u = await getCurrentUser();
  if (!u) throw makeError("Not signed in", 401);
  if (!isAdmin(u)) throw makeError("Not an admin", 403);
  return u;
}

export interface AdminLogEntry {
  id: string;
  admin_user_id: string;
  action: string;
  target_user_id: string | null;
  target_brand_id: string | null;
  payload_json: string | null;
  created_at: number;
}

export function logAdminAction(args: {
  adminUserId: string;
  action: string;
  targetUserId?: string;
  targetBrandId?: string;
  payload?: any;
}) {
  db().prepare(`
    INSERT INTO admin_audit_log (id, admin_user_id, action, target_user_id, target_brand_id, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aal_${nanoid(10)}`, args.adminUserId, args.action,
    args.targetUserId || null, args.targetBrandId || null,
    args.payload ? JSON.stringify(args.payload) : null,
    nowMs(),
  );
}

export function listAdminLog(limit = 100): AdminLogEntry[] {
  return db().prepare("SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ?").all(limit) as AdminLogEntry[];
}

export interface UserSummaryRow {
  id: string;
  email: string;
  name: string;
  avatar_color: string;
  status: string;
  created_at: number;
  last_seen_at: number | null;
  brand_count: number;
  credits_balance: number;
  tier: string;
  lifetime_used: number;
}

export function listUsersWithSummary(): UserSummaryRow[] {
  return db().prepare(`
    SELECT
      u.id, u.email, u.name, u.avatar_color, u.status, u.created_at, u.last_seen_at,
      (SELECT COUNT(*) FROM memberships m WHERE m.user_id = u.id) as brand_count,
      COALESCE(c.balance, 0) as credits_balance,
      COALESCE(c.tier, 'trial') as tier,
      COALESCE(c.lifetime_used, 0) as lifetime_used
    FROM users u
    LEFT JOIN user_credits c ON c.user_id = u.id
    ORDER BY u.created_at DESC
  `).all() as UserSummaryRow[];
}

export function getUserWithSummary(userId: string): UserSummaryRow | null {
  return (db().prepare(`
    SELECT
      u.id, u.email, u.name, u.avatar_color, u.status, u.created_at, u.last_seen_at,
      (SELECT COUNT(*) FROM memberships m WHERE m.user_id = u.id) as brand_count,
      COALESCE(c.balance, 0) as credits_balance,
      COALESCE(c.tier, 'trial') as tier,
      COALESCE(c.lifetime_used, 0) as lifetime_used
    FROM users u
    LEFT JOIN user_credits c ON c.user_id = u.id
    WHERE u.id = ?
  `).get(userId) as UserSummaryRow) || null;
}

export function userBrands(userId: string): Array<{ brand_id: string; brand_name: string; brand_slug: string; role: string }> {
  return db().prepare(`
    SELECT b.id as brand_id, b.name as brand_name, b.slug as brand_slug, m.role
    FROM memberships m JOIN brands b ON b.id = m.brand_id
    WHERE m.user_id = ?
    ORDER BY b.name ASC
  `).all(userId) as any;
}

export function setUserStatus(userId: string, status: "active" | "disabled") {
  db().prepare("UPDATE users SET status = ? WHERE id = ?").run(status, userId);
}

export function touchUserLastSeen(userId: string) {
  db().prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(nowMs(), userId);
}

// Global stats for the overview tile.
export interface AdminStats {
  users: { total: number; active: number; disabled: number; signed_in_last_7d: number };
  brands: number;
  campaigns: number;
  generations: { total: number; pending: number; approved: number };
  credits: { total_balance: number; lifetime_used: number };
  agent_runs: { total: number; claude: number; mock: number; cost_micros: number };
}

export function adminStats(): AdminStats {
  const usersTotal = (db().prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
  const usersActive = (db().prepare("SELECT COUNT(*) as c FROM users WHERE status = 'active'").get() as any).c;
  const usersDisabled = usersTotal - usersActive;
  const recentCutoff = Date.now() - 7 * 86400_000;
  const recent = (db().prepare("SELECT COUNT(*) as c FROM users WHERE last_seen_at >= ?").get(recentCutoff) as any).c;

  const brands = (db().prepare("SELECT COUNT(*) as c FROM brands").get() as any).c;
  const campaigns = (db().prepare("SELECT COUNT(*) as c FROM campaigns").get() as any).c;
  const genTotal = (db().prepare("SELECT COUNT(*) as c FROM generations").get() as any).c;
  const genPending = (db().prepare("SELECT COUNT(*) as c FROM generations WHERE status = 'pending_review'").get() as any).c;
  const genApproved = (db().prepare("SELECT COUNT(*) as c FROM generations WHERE status = 'approved'").get() as any).c;

  const creditsRow = db().prepare("SELECT COALESCE(SUM(balance), 0) as bal, COALESCE(SUM(lifetime_used), 0) as used FROM user_credits").get() as any;
  const runsTotal = (db().prepare("SELECT COUNT(*) as c FROM agent_runs").get() as any).c;
  const runsClaude = (db().prepare("SELECT COUNT(*) as c FROM agent_runs WHERE provider = 'claude'").get() as any).c;
  const runsMock = (db().prepare("SELECT COUNT(*) as c FROM agent_runs WHERE provider = 'mock'").get() as any).c;
  const cost = (db().prepare("SELECT COALESCE(SUM(cost_micros), 0) as c FROM agent_runs").get() as any).c;

  return {
    users: { total: usersTotal, active: usersActive, disabled: usersDisabled, signed_in_last_7d: recent },
    brands, campaigns,
    generations: { total: genTotal, pending: genPending, approved: genApproved },
    credits: { total_balance: creditsRow.bal, lifetime_used: creditsRow.used },
    agent_runs: { total: runsTotal, claude: runsClaude, mock: runsMock, cost_micros: cost },
  };
}

function makeError(msg: string, status: number) {
  const e = new Error(msg);
  (e as any).status = status;
  return e;
}
