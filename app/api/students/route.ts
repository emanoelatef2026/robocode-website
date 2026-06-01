import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function GET() {
  try {
    // featured=true means visible on website  (was: is_active)
    // youtube_url is the optional project/demo link  (was: project_link)
    const { data, error } = await getSupabaseAdmin()
      .from("featured_students")
      .select("id, name, image_url, achievement_title, achievement_description, youtube_url, sort_order")
      .eq("featured", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[api/students GET] table=featured_students error_code=%s message=%s", error.code, error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
