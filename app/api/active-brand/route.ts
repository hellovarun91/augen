import { NextRequest } from "next/server";
import { setActiveBrand } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("missing id", { status: 400 });
  await setActiveBrand(id);
  return new Response(null, { status: 204 });
}
