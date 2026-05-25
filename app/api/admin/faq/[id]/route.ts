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
    const allowed = ["question", "answer", "category", "active", "sort_order"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) { if (k in body) update[k] = body[k]; }

    const { data, error } = await getSupabaseAdmin()
      .from("faq_items").update(update).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/faq PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await getSupabaseAdmin().from("faq_items").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/faq DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
