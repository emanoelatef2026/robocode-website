import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DB columns (after migration): id, title, description, image_url, created_at,
//   student_id, course_id, video_url, drive_url, github_url, status,
//   approved_by, approved_at, deleted_at, updated_at, sort_order,
//   technologies, difficulty, age_group, featured

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("student_projects")
      .select("*")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[studio/projects GET] table=student_projects error_code=%s message=%s", error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[studio/projects GET] unexpected:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    let image_url: string | null = null;

    if (imageFile && imageFile.size > 0) {
      const bytes  = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

      const { error: uploadError } = await getSupabaseAdmin().storage
        .from("projects")
        .upload(path, buffer, { contentType: imageFile.type, upsert: false });

      if (uploadError) {
        console.error("[studio/projects POST] storage error:", uploadError.message);
        throw uploadError;
      }

      const { data: urlData } = getSupabaseAdmin().storage.from("projects").getPublicUrl(path);
      image_url = urlData.publicUrl;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("student_projects")
      .insert({ title, description, technologies, image_url, video_url, difficulty, age_group, featured })
      .select()
      .single();

    if (error) {
      console.error("[studio/projects POST] table=student_projects error_code=%s message=%s", error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[studio/projects POST] unexpected:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
