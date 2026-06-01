import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("student_projects")
      .select("id, title, description, technologies, image_url, difficulty, age_group, featured, video_url")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api/projects GET] table=student_projects error_code=%s message=%s", error.code, error.message);
      return NextResponse.json([]);
    }

    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("[api/projects GET] unexpected:", err);
    return NextResponse.json([]);
  }
}
