import { NextRequest } from "next/server";
import { getBrand, getFigmaWebhookByWebhookId, setFigmaWebhookEvent, updateBrandTokens } from "@/lib/repo";
import { pullVariables, mergeTokens } from "@/lib/figma/sync";
import { BrandTokens } from "@/lib/types";

export const dynamic = "force-dynamic";

// Figma Webhooks v2 receiver. Figma POSTs here on PING (at registration) and
// FILE_UPDATE (when a file in the team changes). We verify the passcode, and on
// a matching file pull the latest Variables and merge them into the brand tokens.
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return json({ ok: false }, 400); }

  const webhookId = String(body?.webhook_id || "");
  const rec = webhookId ? getFigmaWebhookByWebhookId(webhookId) : null;
  // Always 200 on unknown hooks so we don't leak which ids exist.
  if (!rec) return json({ ok: true });
  if (body?.passcode !== rec.passcode) return json({ ok: false, error: "bad passcode" }, 401);

  const event = String(body?.event_type || "");
  if (event === "PING") {
    setFigmaWebhookEvent(webhookId, "ping ok");
    return json({ ok: true });
  }
  if (event !== "FILE_UPDATE") {
    setFigmaWebhookEvent(webhookId, `ignored: ${event}`);
    return json({ ok: true });
  }

  // Only react to the file this brand is bound to.
  if (rec.active !== 1) { setFigmaWebhookEvent(webhookId, "paused"); return json({ ok: true }); }
  if (String(body?.file_key || "") !== rec.file_key) { setFigmaWebhookEvent(webhookId, "other file"); return json({ ok: true }); }

  try {
    const brand = getBrand(rec.brand_id);
    if (!brand) { setFigmaWebhookEvent(webhookId, "brand gone"); return json({ ok: true }); }
    const pull = await pullVariables(rec.file_key);
    const changed = Object.keys(pull.tokens).length;
    if (changed) {
      const merged = BrandTokens.parse(mergeTokens(brand.tokens, pull.tokens));
      updateBrandTokens(rec.brand_id, merged);
      setFigmaWebhookEvent(webhookId, `synced ${changed} group${changed === 1 ? "" : "s"}`);
    } else {
      setFigmaWebhookEvent(webhookId, "no mappable variables");
    }
  } catch (e: any) {
    setFigmaWebhookEvent(webhookId, `error: ${(e?.message || "pull failed").slice(0, 80)}`);
  }
  // 200 either way — a pull error shouldn't trigger Figma's retry storm.
  return json({ ok: true });
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
