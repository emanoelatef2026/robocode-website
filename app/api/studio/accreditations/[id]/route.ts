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
    const allowed = ["name", "active", "sort_order", "website_url"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) { if (k in body) update[k] = body[k]; }

    const { data, error } = await getSupabaseAdmin()
      .from("accreditations").update(update).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/accreditations PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: row } = await getSupabaseAdmin()
      .from("accreditations").select("logo_url").eq("id", id).single();

    const { error } = await getSupabaseAdmin().from("accreditations").delete().eq("id", id);
    if (error) throw error;

    if (row?.logo_url) {
      const path = new URL(row.logo_url).pathname.split("/accreditations/")[1];
      if (path) await getSupabaseAdmin().storage.from("accreditations").remove([path]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/accreditations DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
