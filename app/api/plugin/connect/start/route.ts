import { NextRequest } from "next/server";
import { createDeviceCode } from "@/lib/repo";
import { pluginJson, pluginPreflight } from "@/lib/plugin";

export const dynamic = "force-dynamic";
export function OPTIONS() { return pluginPreflight(); }

// Starts a device-auth flow. Returns a code the plugin polls with, and the URL
// the user opens in their browser to approve (inside their Augen session).
export async function POST(req: NextRequest) {
  const { code } = createDeviceCode();
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  return pluginJson({ code, verifyUrl: `${origin}/connect?code=${code}` });
}
