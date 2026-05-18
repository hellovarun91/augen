// Authorization helpers. Distinct from session: these enforce *who can do what*.
import { getCurrentUser, userHasBrandAccess } from "./users";
import { getCampaign, getGeneration, getIdea } from "./repo";

export function emailAllowlist(): string[] {
  const raw = process.env.AUGEN_ALLOWED_EMAILS;
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isAllowlistEnforced(): boolean {
  return emailAllowlist().length > 0;
}

export function isEmailAllowed(email: string): boolean {
  if (!isAllowlistEnforced()) return true; // no allowlist → open
  return emailAllowlist().includes(email.toLowerCase());
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
