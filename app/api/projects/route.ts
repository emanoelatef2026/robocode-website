import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("student_projects")
      .select("id, title, description, technologies, image_url, difficulty, age_group, featured")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("[projects public GET]", err);
    return NextResponse.json([]);
  }
}
