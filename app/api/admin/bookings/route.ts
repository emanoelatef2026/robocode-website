import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("trial_bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[bookings GET]", err);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}
