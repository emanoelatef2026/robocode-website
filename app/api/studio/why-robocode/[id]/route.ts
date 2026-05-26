import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }        = await params;
    const contentType   = request.headers.get("content-type") ?? "";
    const update: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      // ── FormData path — handles optional image replacement ────────────────
      const fd        = await request.formData();
      const tab_name  = (fd.get("tab_name") as string)?.trim();
      const sort_order = fd.get("sort_order");
      const is_active  = fd.get("is_active");
      const imageFile  = fd.get("image") as File | null;

      if (tab_name)     update.tab_name   = tab_name;
      if (sort_order !== null) update.sort_order = parseInt(sort_order as string, 10);
      if (is_active  !== null) update.is_active  = is_active === "true";

      if (imageFile && imageFile.size > 0) {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

        const { error: uploadErr } = await getSupabaseAdmin().storage
          .from("why-robocode")
          .upload(path, buffer, { contentType: imageFile.type, upsert: false });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = getSupabaseAdmin().storage
          .from("why-robocode")
          .getPublicUrl(path);
        update.image_url = urlData.publicUrl;

        // Delete the previous image from storage
        const { data: row } = await getSupabaseAdmin()
          .from("why_robocode_tabs")
          .select("image_url")
          .eq("id", id)
          .single();
        if (row?.image_url) {
          const oldPath = new URL(row.image_url).pathname.split("/why-robocode/")[1];
          if (oldPath) {
            await getSupabaseAdmin().storage.from("why-robocode").remove([oldPath]);
          }
        }
      }
    } else {
      // ── JSON path — metadata-only updates ────────────────────────────────
      const body   = await request.json() as Record<string, unknown>;
      const allowed = ["tab_name", "is_active", "sort_order"];
      for (const k of allowed) {
        if (k in body) update[k] = body[k];
      }
    }

    const { data, error } = await getSupabaseAdmin()
      .from("why_robocode_tabs")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[studio/why-robocode/:id PATCH]", err);
    return NextResponse.json({ error: "Failed to update tab" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: row } = await getSupabaseAdmin()
      .from("why_robocode_tabs")
      .select("image_url")
      .eq("id", id)
      .single();

    const { error } = await getSupabaseAdmin()
      .from("why_robocode_tabs")
      .delete()
      .eq("id", id);
    if (error) throw error;

    if (row?.image_url) {
      const path = new URL(row.image_url).pathname.split("/why-robocode/")[1];
      if (path) await getSupabaseAdmin().storage.from("why-robocode").remove([path]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[studio/why-robocode/:id DELETE]", err);
    return NextResponse.json({ error: "Failed to delete tab" }, { status: 500 });
  }
}
