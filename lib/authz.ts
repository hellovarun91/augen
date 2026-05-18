// Authorization helpers. Distinct from session: these enforce *who can do what*.
import { getCurrentUser, userHasBrandAccess } from "./users";
import { getCampaign, getGeneration, getIdea } from "./repo";
import { db, nowMs } from "./db";

// Allowlist sources, in order of precedence:
//   1) DB-managed allowlist (table allowed_emails) — admins edit this via /admin/testers
//   2) Env var AUGEN_ALLOWED_EMAILS — bootstrap / fallback when DB is empty
//   3) Empty — sign-in is open to anyone
export function dbAllowlist(): string[] {
  try {
    const rows = db().prepare("SELECT email FROM allowed_emails").all() as Array<{ email: string }>;
    return rows.map((r) => r.email.toLowerCase());
  } catch {
    return [];
  }
}

export function envAllowlist(): string[] {
  const raw = process.env.AUGEN_ALLOWED_EMAILS;
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function effectiveAllowlist(): string[] {
  const fromDb = dbAllowlist();
  if (fromDb.length > 0) return fromDb;
  return envAllowlist();
}

export function isAllowlistEnforced(): boolean {
  return effectiveAllowlist().length > 0;
}

export function isEmailAllowed(email: string): boolean {
  if (!isAllowlistEnforced()) return true; // no allowlist → open
  return effectiveAllowlist().includes(email.toLowerCase());
}

// CRUD for admin UI
export interface AllowedEmailRow {
  email: string;
  added_by_user_id: string | null;
  added_at: number;
  note: string | null;
}

export function listAllowedEmails(): AllowedEmailRow[] {
  try {
    return db().prepare("SELECT * FROM allowed_emails ORDER BY added_at DESC").all() as AllowedEmailRow[];
  } catch {
    return [];
  }
}

export function addAllowedEmail(email: string, addedByUserId: string, note?: string) {
  const lc = email.toLowerCase().trim();
  if (!lc) throw new Error("Email required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lc)) throw new Error("Invalid email");
  db().prepare(`
    INSERT INTO allowed_emails (email, added_by_user_id, added_at, note)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET note = excluded.note
  `).run(lc, addedByUserId, nowMs(), note || null);
}

export function removeAllowedEmail(email: string) {
  db().prepare("DELETE FROM allowed_emails WHERE email = ?").run(email.toLowerCase());
}

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw makeError("Not signed in", 401);
  return u;
}

export async function requireBrandAccess(brandId: string) {
  const u = await requireUser();
  if (!userHasBrandAccess(u.id, brandId)) throw makeError("No access to this brand", 403);
  return u;
}

export async function requireCampaignAccess(campaignId: string) {
  const c = getCampaign(campaignId);
  if (!c) throw makeError("Campaign not found", 404);
  const u = await requireBrandAccess(c.brand_id);
  return { user: u, campaign: c };
}

export async function requireGenerationAccess(generationId: string) {
  const g = getGeneration(generationId);
  if (!g) throw makeError("Generation not found", 404);
  const u = await requireBrandAccess(g.brand_id);
  return { user: u, generation: g };
}

export async function requireIdeaAccess(ideaId: string) {
  const i = getIdea(ideaId);
  if (!i) throw makeError("Idea not found", 404);
  const c = getCampaign(i.campaign_id);
  if (!c) throw makeError("Campaign not found", 404);
  const u = await requireBrandAccess(c.brand_id);
  return { user: u, idea: i, campaign: c };
}

function makeError(message: string, status: number): Error {
  const e = new Error(message);
  (e as any).status = status;
  return e;
}
