import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("featured_students")
      .select("id, name, grade, country, image_url, youtube_url")
      .eq("featured", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[students GET]", err);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}
