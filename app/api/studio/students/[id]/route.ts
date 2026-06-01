import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

// DB columns: id, name, grade, country, image_url, youtube_url, featured,
//             sort_order, created_at, achievement_title, achievement_description

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }      = await params;
    const contentType = request.headers.get("content-type") ?? "";
    const update: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      const fd        = await request.formData();
      const imageFile = fd.get("image") as File | null;
      const name      = (fd.get("name")                    as string)?.trim();
      const achTitle  = (fd.get("achievement_title")       as string)?.trim();
      const achDesc   = (fd.get("achievement_description") as string)?.trim();
      const ytUrl     = (fd.get("youtube_url")             as string)?.trim();
      const sortOrder = fd.get("sort_order");
      const featured  = fd.get("featured");

      if (name)                                         update.name                    = name;
      if (achTitle  !== undefined && achTitle  !== null) update.achievement_title       = achTitle  || null;
      if (achDesc   !== undefined && achDesc   !== null) update.achievement_description = achDesc   || null;
      if (ytUrl     !== undefined && ytUrl     !== null) update.youtube_url             = ytUrl     || null;
      if (sortOrder !== null) update.sort_order = parseInt(sortOrder as string, 10);
      if (featured  !== null) update.featured   = featured === "true";

      if (imageFile && imageFile.size > 0) {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

        const { error: uploadErr } = await getSupabaseAdmin().storage
          .from("students")
          .upload(path, buffer, { contentType: imageFile.type, upsert: false });

        if (uploadErr) {
          console.error("[studio/students PATCH] storage error:", uploadErr.message);
          throw uploadErr;
        }

        const { data: urlData } = getSupabaseAdmin().storage.from("students").getPublicUrl(path);
        update.image_url = urlData.publicUrl;

        const { data: row } = await getSupabaseAdmin()
          .from("featured_students")
          .select("image_url")
          .eq("id", id)
          .single();
        if (row?.image_url) {
          const oldPath = new URL(row.image_url).pathname.split("/students/")[1];
          if (oldPath) await getSupabaseAdmin().storage.from("students").remove([oldPath]);
        }
      }
    } else {
      const body    = await request.json() as Record<string, unknown>;
      const allowed = ["name", "achievement_title", "achievement_description", "youtube_url", "featured", "sort_order"];
      for (const k of allowed) {
        if (k in body) update[k] = body[k];
      }
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

    if (error) {
      console.error("[studio/students PATCH] table=featured_students id=%s error_code=%s message=%s", id, error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[studio/students PATCH] unexpected:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: student } = await getSupabaseAdmin()
      .from("featured_students")
      .select("image_url")
      .eq("id", id)
      .single();

    const { error } = await getSupabaseAdmin()
      .from("featured_students")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[studio/students DELETE] table=featured_students id=%s error_code=%s message=%s", id, error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    if (student?.image_url) {
      const path = new URL(student.image_url).pathname.split("/students/")[1];
      if (path) await getSupabaseAdmin().storage.from("students").remove([path]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[studio/students DELETE] unexpected:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
