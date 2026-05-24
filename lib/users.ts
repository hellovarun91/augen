import { db, nowMs } from "./db";
import { nanoid } from "nanoid";
import { cookies } from "next/headers";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar_color: string;
  created_at: number;
}

export interface Membership {
  id: string;
  user_id: string;
  brand_id: string;
  role: string;
  created_at: number;
}

const COOKIE = "augen_uid";

export function createUser(email: string, name: string, avatarColor = "#C9A45C"): UserRow {
  const id = `usr_${nanoid(10)}`;
  db().prepare(`INSERT INTO users (id, email, name, avatar_color, created_at) VALUES (?, ?, ?, ?, ?)`).run(
    id, email, name, avatarColor, nowMs(),
  );
  return db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow;
}

export function getUser(id: string): UserRow | null {
  return (db().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow) || null;
}

export function getUserByEmail(email: string): UserRow | null {
  return (db().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow) || null;
}

export function listUsers(): UserRow[] {
  return db().prepare("SELECT * FROM users ORDER BY created_at ASC").all() as UserRow[];
}

export function addMembership(userId: string, brandId: string, role = "editor"): Membership {
  const id = `mem_${nanoid(10)}`;
  try {
    db().prepare(`INSERT INTO memberships (id, user_id, brand_id, role, created_at) VALUES (?, ?, ?, ?, ?)`).run(
      id, userId, brandId, role, nowMs(),
    );
  } catch {
    return db().prepare("SELECT * FROM memberships WHERE user_id = ? AND brand_id = ?").get(userId, brandId) as Membership;
  }
  return db().prepare("SELECT * FROM memberships WHERE id = ?").get(id) as Membership;
}

export function listMembershipsForUser(userId: string): Membership[] {
  return db().prepare("SELECT * FROM memberships WHERE user_id = ?").all(userId) as Membership[];
}

export function listMembershipsForBrand(brandId: string): Array<Membership & { user: UserRow }> {
  const rows = db().prepare(`
    SELECT m.*, u.email as u_email, u.name as u_name, u.avatar_color as u_color, u.created_at as u_created
    FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.brand_id = ?
    ORDER BY m.created_at ASC
  `).all(brandId) as any[];
  return rows.map((r) => ({
    id: r.id, user_id: r.user_id, brand_id: r.brand_id, role: r.role, created_at: r.created_at,
    user: { id: r.user_id, email: r.u_email, name: r.u_name, avatar_color: r.u_color, created_at: r.u_created },
  }));
}

export function removeMembership(id: string) {
  db().prepare("DELETE FROM memberships WHERE id = ?").run(id);
}

export function getMembership(id: string): Membership | null {
  return (db().prepare("SELECT * FROM memberships WHERE id = ?").get(id) as Membership) || null;
}

export function updateMembershipRole(id: string, role: string) {
  db().prepare("UPDATE memberships SET role = ? WHERE id = ?").run(role, id);
}

export function userHasBrandAccess(userId: string, brandId: string): boolean {
  const row = db().prepare("SELECT 1 FROM memberships WHERE user_id = ? AND brand_id = ?").get(userId, brandId);
  return !!row;
}

export async function getCurrentUserId(): Promise<string | null> {
  const c = await cookies();
  return c.get(COOKIE)?.value || null;
}

export async function getCurrentUser(): Promise<UserRow | null> {
  const id = await getCurrentUserId();
  return id ? getUser(id) : null;
}

export async function setCurrentUser(userId: string) {
  const c = await cookies();
  c.set(COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 });
}

export async function clearCurrentUser() {
  const c = await cookies();
  c.delete(COOKIE);
}

const PASTELS = ["#C9A45C", "#1F4A47", "#D85A3A", "#7C5CFF", "#2D6A7C", "#B2553A", "#345C44", "#F2BB05"];

export function pickAvatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PASTELS[h % PASTELS.length];
}
