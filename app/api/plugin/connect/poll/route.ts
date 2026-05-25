import { NextRequest } from "next/server";
import { pollDeviceCode } from "@/lib/repo";
import { pluginJson, pluginPreflight } from "@/lib/plugin";

export const dynamic = "force-dynamic";
export function OPTIONS() { return pluginPreflight(); }

// The plugin polls here. Once the user has approved in the browser, this returns
// the token exactly once ({ status: "approved", token }), then the code is spent.
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return pluginJson({ status: "expired" }, 400); }
  const code = String(body?.code || "");
  if (!code) return pluginJson({ status: "expired" }, 400);
  return pluginJson(pollDeviceCode(code));
}
