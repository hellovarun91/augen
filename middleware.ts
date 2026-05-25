import { NextRequest, NextResponse } from "next/server";

// These bypass the session gate: render/preview are public assets; the Figma
// webhook and plugin API authenticate themselves (passcode / plugin token).
const PUBLIC = ["/signin", "/api/render", "/api/preview.svg", "/_next", "/favicon", "/api/active-brand", "/api/figma/webhook", "/api/plugin", "/api/mcp"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Expose the current path to server components (for URL-driven brand context).
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);

  if (PUBLIC.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request: { headers } });
  }
  const uid = req.cookies.get("augen_uid")?.value;
  if (!uid) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
