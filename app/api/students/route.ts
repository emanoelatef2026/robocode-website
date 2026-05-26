import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("featured_students")
      .select("id, name, image_url, achievement_title, achievement_description, project_link, sort_order")
      .neq("is_active", false)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
