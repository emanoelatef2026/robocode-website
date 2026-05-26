import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    // Featured approved reviews first, then remaining approved by sort_order
    const { data, error } = await getSupabaseAdmin()
      .from("reviews")
      .select("id, name, role, review, image_url, rating, branch, featured")
      .eq("status", "approved")
      .order("featured", { ascending: false })
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return NextResponse.json([]);
  }
}
