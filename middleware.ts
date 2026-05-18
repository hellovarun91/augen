import { NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/signin", "/api/render", "/api/preview.svg", "/_next", "/favicon", "/api/active-brand"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const uid = req.cookies.get("augen_uid")?.value;
  if (!uid) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
