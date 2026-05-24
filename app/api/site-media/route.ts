import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");

  try {
    let query = getSupabaseAdmin().from("site_media").select("key, image_url, updated_at");
    if (key) query = query.eq("key", key).limit(1);

    const { data, error } = await query;
    if (error) throw error;

    if (key) return NextResponse.json(data?.[0] ?? null);
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[site-media public GET]", err);
    return NextResponse.json(null);
  }
}
