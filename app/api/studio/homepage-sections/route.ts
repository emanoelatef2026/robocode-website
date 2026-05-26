import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

// ── GET: return all sections ordered by sort_order ────────────────────────────

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("homepage_sections")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[homepage-sections GET]", err);
    return NextResponse.json({ error: "Failed to fetch sections" }, { status: 500 });
  }
}

// ── PATCH: bulk update sort_order + enabled for all sections ──────────────────

interface SectionUpdate {
  id:         string;
  sort_order: number;
  enabled:    boolean;
}

export async function PATCH(request: NextRequest) {
  try {
    const updates: SectionUpdate[] = await request.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Run all updates concurrently
    const results = await Promise.all(
      updates.map(({ id, sort_order, enabled }) =>
        getSupabaseAdmin()
          .from("homepage_sections")
          .update({ sort_order, enabled })
          .eq("id", id)
      )
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[homepage-sections PATCH]", err);
    return NextResponse.json({ error: "Failed to update sections" }, { status: 500 });
  }
}
