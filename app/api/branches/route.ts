import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    console.log("[branches GET] querying branches table...");

    const { data, error } = await getSupabaseAdmin()
      .from("branches")
      .select("id, name, phone, location, image_url, sort_order, active, study_mode, created_at")
      // neq false to include rows where active is NULL or true
      .neq("active", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[branches GET] supabase error:", JSON.stringify(error));
      throw error;
    }

    console.log("[branches GET] rows returned:", data?.length ?? 0);

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[branches GET] fatal:", err);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}
