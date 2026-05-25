import { NextRequest } from "next/server";
import { resolveApiToken } from "@/lib/repo";

// CORS for the Figma plugin: its UI iframe makes requests from a null/opaque
// origin, so we allow any origin and authenticate with a token instead of cookies.
export const PLUGIN_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-augen-token, Authorization",
};

// Resolves the personal token (same tokens as MCP — generated at /settings/mcp)
// to a user id. Accepted via `x-augen-token`, `Authorization: Bearer`, or `?token=`.
export function pluginUser(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = (m ? m[1].trim() : null) || req.headers.get("x-augen-token") || new URL(req.url).searchParams.get("token") || "";
  return token ? resolveApiToken(token) : null;
}

// The public origin, honoring Railway's proxy headers (req.url is the internal
// 0.0.0.0:PORT bind address behind the proxy, which is useless in returned URLs).
export function publicOrigin(req: NextRequest): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || new URL(req.url).host;
  const proto = h.get("x-forwarded-proto") || (/^(localhost|127\.|0\.0\.0\.0)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export function pluginJson(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...PLUGIN_CORS } });
}

export function pluginPreflight() {
  return new Response(null, { status: 204, headers: PLUGIN_CORS });
}
