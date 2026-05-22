import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/admin/login" ||
    pathname === "/api/admin/login"
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("admin_session")?.value;
  const secret  = process.env.ADMIN_SECRET;

  if (!session || !secret || session !== secret) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
