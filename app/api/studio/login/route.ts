import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    // Verify the entered password against ADMIN_PASSWORD
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const sessionToken = process.env.ADMIN_SECRET;
    if (!sessionToken) {
      console.error("[studio/login] ADMIN_SECRET env var is not set");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const response = NextResponse.json({ success: true });

    // Store ADMIN_SECRET as the session token — NOT the password itself.
    // The middleware verifies this cookie against ADMIN_SECRET.
    response.cookies.set("studio_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
