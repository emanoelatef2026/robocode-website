import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await request.json() as Record<string, unknown>;
    const allowed = ["name", "role", "review", "rating", "branch", "active", "sort_order", "status", "featured"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) { if (k in body) update[k] = body[k]; }

    const { data, error } = await getSupabaseAdmin()
      .from("reviews").update(update).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[studio/reviews PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch image_url for storage cleanup
    const { data: row } = await getSupabaseAdmin()
      .from("reviews")
      .select("image_url")
      .eq("id", id)
      .single();

    const { error } = await getSupabaseAdmin().from("reviews").delete().eq("id", id);
    if (error) throw error;

    if (row?.image_url) {
      const path = new URL(row.image_url).pathname.split("/reviews/")[1];
      if (path) await getSupabaseAdmin().storage.from("reviews").remove([path]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[studio/reviews DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
