import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("learning_journey_stages")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch {
    // Fail silently — frontend uses static fallback
    return NextResponse.json([]);
  }
}
