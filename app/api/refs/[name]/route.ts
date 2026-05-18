import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { refsDir } from "@/lib/db";

export const dynamic = "force-dynamic";

// Refs no longer live under /public/refs (so they can sit on a persistent volume
// outside the build). This route serves them with the right Content-Type.
export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  // Defense against directory traversal — only allow basename.
  const safe = path.basename(name);
  if (safe !== name) return new Response("Bad name", { status: 400 });

  const abs = path.join(refsDir(), safe);
  let buf: Buffer;
  try {
    buf = await fs.readFile(abs);
  } catch {
    // Backwards compat: pre-volume files were stored under public/refs/
    try {
      const legacy = path.join(process.cwd(), "public", "refs", safe);
      buf = await fs.readFile(legacy);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  const mime = inferMime(safe);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}

function inferMime(name: string): string {
  const lc = name.toLowerCase();
  if (lc.endsWith(".png")) return "image/png";
  if (lc.endsWith(".webp")) return "image/webp";
  if (lc.endsWith(".gif")) return "image/gif";
  if (lc.endsWith(".avif")) return "image/avif";
  if (lc.endsWith(".jpg") || lc.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
