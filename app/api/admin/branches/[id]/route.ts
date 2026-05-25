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
    const formData = await request.formData();

    const name       = (formData.get("name")       as string)?.trim();
    const phone      = (formData.get("phone")      as string)?.trim() || null;
    const location   = (formData.get("location")   as string)?.trim() || null;
    const sort_order = parseInt((formData.get("sort_order") as string) || "0", 10);
    const active     = formData.get("active") !== "false";
    const study_mode = (formData.get("study_mode") as string) || "offline";
    const imageFile  = formData.get("image") as File | null;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { name, phone, location, sort_order, active, study_mode };

    if (imageFile && imageFile.size > 0) {
      const bytes  = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

      const { error: uploadError } = await getSupabaseAdmin().storage
        .from("branches")
        .upload(path, buffer, { contentType: imageFile.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = getSupabaseAdmin().storage
        .from("branches")
        .getPublicUrl(path);

      updates.image_url = urlData.publicUrl;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("branches")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/branches PATCH]", err);
    return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await getSupabaseAdmin()
      .from("branches")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/branches DELETE]", err);
    return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 });
  }
}
