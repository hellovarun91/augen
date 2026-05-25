import { NextRequest } from "next/server";

// CORS for the Figma plugin: its UI iframe makes requests from a null/opaque
// origin, so we allow any origin and authenticate with a token instead of cookies.
export const PLUGIN_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-augen-token",
};

export function pluginConfigured(): boolean {
  return !!process.env.PLUGIN_API_TOKEN;
}

// Accepts the token via `x-augen-token` header or `?token=` query param.
export function pluginAuthorized(req: NextRequest): boolean {
  const expected = process.env.PLUGIN_API_TOKEN;
  if (!expected) return false;
  const got = req.headers.get("x-augen-token") || new URL(req.url).searchParams.get("token") || "";
  return got === expected;
}

export function pluginJson(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...PLUGIN_CORS } });
}

export function pluginPreflight() {
  return new Response(null, { status: 204, headers: PLUGIN_CORS });
}
