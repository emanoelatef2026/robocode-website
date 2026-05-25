import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function fetchBranches(includeStudyMode: boolean) {
  const cols = includeStudyMode
    ? "id, name, phone, location, image_url, sort_order, active, study_mode, created_at"
    : "id, name, phone, location, image_url, sort_order, active, created_at";

  return getSupabaseAdmin()
    .from("branches")
    .select(cols)
    .neq("active", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
}

export async function GET() {
  try {
    let { data, error } = await fetchBranches(true);

    // PostgreSQL 42703 = undefined_column: study_mode migration not yet applied — retry without it.
    if (error?.code === "42703") {
      ({ data, error } = await fetchBranches(false) as Awaited<ReturnType<typeof fetchBranches>>);
    }

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[branches GET]", err);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}
