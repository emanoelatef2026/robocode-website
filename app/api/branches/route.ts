import { NextResponse } from "next/server";
import { getSupabasePublic } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabasePublic()
      .from("branches")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[branches GET]", err);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}
