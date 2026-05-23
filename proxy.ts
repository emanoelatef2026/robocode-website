import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login page and its API are always public — never require auth
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  // All other /admin/* and /api/admin/* require a valid session cookie
  const session  = request.cookies.get("admin_session")?.value;
  const password = process.env.ADMIN_PASSWORD;

  if (!session || !password || session !== password) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

// Runs ONLY on admin paths — public routes (/, /book-session, /api/book-session) are never touched
export const config = {
  matcher: ["/admin(.*)", "/api/admin(.*)"],
};
