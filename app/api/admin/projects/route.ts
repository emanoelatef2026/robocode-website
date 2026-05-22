import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("student_projects")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[projects GET]", err);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract text fields
    const title       = (formData.get("title")       as string)?.trim();
    const description = (formData.get("description") as string)?.trim() || null;
    const techRaw     = (formData.get("technologies") as string)?.trim() || "";
    const video_url   = (formData.get("video_url")   as string)?.trim() || null;
    const difficulty  = (formData.get("difficulty")  as string) || null;
    const age_group   = (formData.get("age_group")   as string)?.trim() || null;
    const featured    = formData.get("featured") === "true";
    const imageFile   = formData.get("image") as File | null;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Split technologies by comma
    const technologies = techRaw
      ? techRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : null;

    let image_url: string | null = null;

    // Upload image if provided
    if (imageFile && imageFile.size > 0) {
      const bytes  = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

      const { error: uploadError } = await getSupabaseAdmin().storage
        .from("projects")
        .upload(path, buffer, { contentType: imageFile.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = getSupabaseAdmin().storage
        .from("projects")
        .getPublicUrl(path);

      image_url = urlData.publicUrl;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("student_projects")
      .insert({ title, description, technologies, image_url, video_url, difficulty, age_group, featured })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[projects POST]", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
