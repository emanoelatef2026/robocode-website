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

    const title        = (formData.get("title")        as string)?.trim();
    const description  = (formData.get("description")  as string)?.trim() || null;
    const techRaw      = (formData.get("technologies") as string)?.trim() || "";
    const video_url    = (formData.get("video_url")    as string)?.trim() || null;
    const difficulty   = (formData.get("difficulty")   as string) || null;
    const age_group    = (formData.get("age_group")    as string)?.trim() || null;
    const featured     = formData.get("featured") === "true";
    const imageFile    = formData.get("image") as File | null;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const technologies = techRaw
      ? techRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : null;

    const updates: Record<string, unknown> = {
      title, description, technologies, video_url, difficulty, age_group, featured,
    };

    if (imageFile && imageFile.size > 0) {
      const bytes  = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

      const { error: uploadError } = await getSupabaseAdmin().storage
        .from("projects")
        .upload(path, buffer, { contentType: imageFile.type, upsert: false });

      if (uploadError) {
        console.error("[studio/projects PATCH] storage error:", uploadError.message);
        throw uploadError;
      }

      const { data: urlData } = getSupabaseAdmin().storage.from("projects").getPublicUrl(path);
      updates.image_url = urlData.publicUrl;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("student_projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[studio/projects PATCH] table=student_projects id=%s error_code=%s message=%s", id, error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[studio/projects PATCH] unexpected:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await getSupabaseAdmin()
      .from("student_projects")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[studio/projects DELETE] table=student_projects id=%s error_code=%s message=%s", id, error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[studio/projects DELETE] unexpected:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
