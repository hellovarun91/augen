import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireCampaignAccess } from "@/lib/authz";

export const dynamic = "force-dynamic";

// Lightweight progress poll for the Generate-ads button: agent steps run so far
// and ads persisted so far, since the run started (?since=<ms epoch>).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try { await requireCampaignAccess(id); } catch { return new Response("Unauthorized", { status: 401 }); }
  const since = parseInt(new URL(req.url).searchParams.get("since") || "0", 10) || 0;
  const runs = (db().prepare("SELECT COUNT(*) c FROM agent_runs WHERE campaign_id = ? AND created_at >= ?").get(id, since) as { c: number }).c;
  const ads = (db().prepare("SELECT COUNT(*) c FROM generations WHERE campaign_id = ? AND created_at >= ?").get(id, since) as { c: number }).c;
  const status = (db().prepare("SELECT status FROM campaigns WHERE id = ?").get(id) as { status: string } | undefined)?.status || "";
  return Response.json({ runs, ads, status });
}
