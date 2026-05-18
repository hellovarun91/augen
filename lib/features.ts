import { db, nowMs } from "./db";

export interface FeatureFlag {
  name: string;
  description: string | null;
  enabled_globally: number;
  default_on_for_admins: number;
  created_at: number;
  updated_at: number;
}

// Built-in flag registry — these get auto-seeded on first access.
// Add a flag here, then optionally set its default state via env.
const BUILT_IN_FLAGS: Array<{ name: string; description: string; defaultGlobal?: boolean }> = [
  { name: "agent_chain.real_claude", description: "Allow real Claude calls (else mock-only).", defaultGlobal: true },
  { name: "agent_chain.real_gemini", description: "Allow real Gemini image generation.", defaultGlobal: true },
  { name: "variations.matrix_builder", description: "Per-idea variation matrix editor + CSV import.", defaultGlobal: true },
  { name: "ai.token_extraction", description: "Claude-vision token extraction from finished artwork.", defaultGlobal: true },
  { name: "figma.sync", description: "Two-way Figma Variables sync.", defaultGlobal: true },
  { name: "launch.handover_zip", description: "Download the approved-ads ZIP bundle.", defaultGlobal: true },
  { name: "beta.copy_lab_constraints", description: "Operator constraints on Copy Lab spins.", defaultGlobal: true },
];

let _seeded = false;
function ensureSeed() {
  if (_seeded) return;
  const now = nowMs();
  for (const f of BUILT_IN_FLAGS) {
    db().prepare(`
      INSERT OR IGNORE INTO feature_flags (name, description, enabled_globally, default_on_for_admins, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `).run(f.name, f.description, f.defaultGlobal ? 1 : 0, now, now);
  }
  _seeded = true;
}

export function listFeatureFlags(): FeatureFlag[] {
  ensureSeed();
  return db().prepare("SELECT * FROM feature_flags ORDER BY name ASC").all() as FeatureFlag[];
}

export function setFeatureGlobalState(name: string, enabled: boolean) {
  ensureSeed();
  db().prepare("UPDATE feature_flags SET enabled_globally = ?, updated_at = ? WHERE name = ?").run(enabled ? 1 : 0, nowMs(), name);
}

export function setUserOverride(name: string, userId: string, enabled: boolean | null) {
  ensureSeed();
  if (enabled == null) {
    db().prepare("DELETE FROM feature_flag_user_overrides WHERE flag_name = ? AND user_id = ?").run(name, userId);
    return;
  }
  db().prepare(`
    INSERT INTO feature_flag_user_overrides (flag_name, user_id, enabled, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(flag_name, user_id) DO UPDATE SET enabled = excluded.enabled
  `).run(name, userId, enabled ? 1 : 0, nowMs());
}

export function listUserOverrides(userId: string): Array<{ flag_name: string; enabled: number }> {
  return db().prepare("SELECT flag_name, enabled FROM feature_flag_user_overrides WHERE user_id = ?").all(userId) as any;
}

// The runtime check. Order: user override > global flag.
export function isFeatureEnabled(name: string, userId: string | null = null, opts: { adminUser?: boolean } = {}): boolean {
  ensureSeed();
  if (userId) {
    const ov = db().prepare("SELECT enabled FROM feature_flag_user_overrides WHERE flag_name = ? AND user_id = ?").get(name, userId) as { enabled: number } | undefined;
    if (ov) return ov.enabled === 1;
  }
  const f = db().prepare("SELECT enabled_globally, default_on_for_admins FROM feature_flags WHERE name = ?").get(name) as { enabled_globally: number; default_on_for_admins: number } | undefined;
  if (!f) return false;
  if (f.enabled_globally) return true;
  if (opts.adminUser && f.default_on_for_admins) return true;
  return false;
}
