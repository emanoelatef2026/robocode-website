import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getSupabaseAdmin();

    const [settingsRes, tabsRes] = await Promise.all([
      db.from("why_robocode_settings").select("*").limit(1).single(),
      db
        .from("why_robocode_tabs")
        .select("id, tab_name, image_url, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    return NextResponse.json({
      settings: settingsRes.data ?? null,
      tabs:     tabsRes.data   ?? [],
    });
  } catch (err) {
    console.error("[why-robocode GET]", err);
    return NextResponse.json({ settings: null, tabs: [] });
  }
}
