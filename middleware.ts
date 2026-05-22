import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the login page and its API — no auth needed
  if (
    pathname === "/admin/login" ||
    pathname === "/api/admin/login"
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("admin_session")?.value;
  const secret  = process.env.ADMIN_PASSWORD;

  if (!session || !secret || session !== secret) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect all /admin and /api/admin routes
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
