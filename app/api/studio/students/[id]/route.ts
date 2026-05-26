import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await request.json() as Record<string, unknown>;

    const allowed = ["name", "grade", "country", "youtube_url", "featured", "sort_order", "image_url"];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("featured_students")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/students PATCH]", err);
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch record to get image path for storage cleanup
    const { data: student } = await getSupabaseAdmin()
      .from("featured_students")
      .select("image_url")
      .eq("id", id)
      .single();

    const { error } = await getSupabaseAdmin()
      .from("featured_students")
      .delete()
      .eq("id", id);

    if (error) throw error;

    // Best-effort storage cleanup
    if (student?.image_url) {
      const url  = new URL(student.image_url);
      const path = url.pathname.split("/students/")[1];
      if (path) {
        await getSupabaseAdmin().storage.from("students").remove([path]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/students DELETE]", err);
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 });
  }
}
