import { NextRequest } from "next/server";
import { resolveApiToken } from "@/lib/repo";
import { TOOL_DEFS, callTool } from "@/lib/mcp/tools";
import { publicOrigin } from "@/lib/plugin";

export const dynamic = "force-dynamic";

// Stateless Streamable-HTTP MCP server. Authenticates every request with a
// personal token (Authorization: Bearer augen_… or x-augen-token), then handles
// the JSON-RPC methods Claude Desktop / Claude Code use: initialize, tools/list,
// tools/call. Server-initiated streaming (SSE GET) isn't needed — tools are
// request/response — so GET returns 405.
const PROTOCOL_VERSION = "2025-06-18";

function tokenFrom(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  return req.headers.get("x-augen-token");
}

function rpc(id: any, result: any) {
  return Response.json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: any, code: number, message: string, status = 200) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), { status, headers: { "Content-Type": "application/json" } });
}

export function GET() {
  return new Response("MCP endpoint — POST JSON-RPC here. Configure as a remote MCP server.", { status: 405 });
}

export async function POST(req: NextRequest) {
  const userId = resolveApiToken(tokenFrom(req) || "");
  if (!userId) {
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized — supply a valid Augen token." } }), {
      status: 401, headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" },
    });
  }

  let msg: any;
  try { msg = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  if (Array.isArray(msg)) return rpcError(null, -32600, "Batch requests are not supported.");

  const { id, method, params } = msg || {};

  // Notifications (no id) get an empty 202.
  if (id === undefined || id === null) {
    return new Response(null, { status: 202 });
  }

  try {
    switch (method) {
      case "initialize":
        return rpc(id, {
          protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "augen", version: "1.0.0" },
          instructions: "Augen ad studio. Browse brands/projects/creatives, brainstorm and create projects, edit copy, approve/reject, and generate ads. All actions are scoped to your brands.",
        });
      case "ping":
        return rpc(id, {});
      case "tools/list":
        return rpc(id, { tools: TOOL_DEFS });
      case "tools/call": {
        const name = params?.name;
        const args = params?.arguments || {};
        if (!name) return rpcError(id, -32602, "Missing tool name.");
        try {
          const result = await callTool(userId, name, args, publicOrigin(req));
          return rpc(id, result);
        } catch (e: any) {
          // Tool-level failures are returned as a tool result with isError, per MCP.
          return rpc(id, { content: [{ type: "text", text: e?.message || "Tool error" }], isError: true });
        }
      }
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e: any) {
    return rpcError(id, -32603, e?.message || "Internal error");
  }
}
