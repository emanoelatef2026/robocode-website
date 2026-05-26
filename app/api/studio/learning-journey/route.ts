import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("learning_journey_stages")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[admin/learning-journey GET]", err);
    return NextResponse.json({ error: "Failed to fetch stages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData    = await request.formData();
    const imageFile   = formData.get("image") as File | null;
    const title       = (formData.get("title")       as string | null)?.trim() ?? "";
    const ageRange    = (formData.get("age_range")   as string | null)?.trim() ?? "";
    const description = (formData.get("description") as string | null)?.trim() ?? "";
    const skills      = JSON.parse((formData.get("skills")       as string) ?? "[]") as string[];
    const technologies = JSON.parse((formData.get("technologies") as string) ?? "[]") as string[];
    const outcomes    = JSON.parse((formData.get("outcomes")     as string) ?? "[]") as string[];
    const sortOrder   = parseInt((formData.get("sort_order") as string) ?? "0", 10);
    const active      = (formData.get("active") as string) !== "false";

    if (!title)       return NextResponse.json({ error: "Title is required" },       { status: 400 });
    if (!ageRange)    return NextResponse.json({ error: "Age range is required" },   { status: 400 });
    if (!description) return NextResponse.json({ error: "Description is required" }, { status: 400 });

    let imageUrl = "";

    if (imageFile && imageFile.size > 0) {
      const bytes  = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

      const { error: uploadError } = await getSupabaseAdmin().storage
        .from("learning-journey")
        .upload(path, buffer, { contentType: imageFile.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = getSupabaseAdmin().storage
        .from("learning-journey")
        .getPublicUrl(path);

      imageUrl = urlData.publicUrl;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("learning_journey_stages")
      .insert({
        title,
        age_range:   ageRange,
        description,
        image_url:   imageUrl,
        skills,
        technologies,
        outcomes,
        sort_order:  isNaN(sortOrder) ? 0 : sortOrder,
        active,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[admin/learning-journey POST]", err);
    return NextResponse.json({ error: "Failed to create stage" }, { status: 500 });
  }
}
