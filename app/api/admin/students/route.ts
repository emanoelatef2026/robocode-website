import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("featured_students")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[admin/students GET]", err);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData   = await request.formData();
    const imageFile  = formData.get("image") as File | null;
    const name       = (formData.get("name")        as string)?.trim();
    const grade      = (formData.get("grade")       as string)?.trim();
    const country    = (formData.get("country")     as string)?.trim();
    const youtubeUrl = (formData.get("youtube_url") as string)?.trim();
    const featured   = formData.get("featured") === "true";
    const sortOrder  = parseInt((formData.get("sort_order") as string) ?? "0", 10);

    if (!name)       return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!grade)      return NextResponse.json({ error: "Grade is required" }, { status: 400 });
    if (!country)    return NextResponse.json({ error: "Country is required" }, { status: 400 });
    if (!youtubeUrl) return NextResponse.json({ error: "YouTube URL is required" }, { status: 400 });
    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const bytes  = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

    const { error: uploadError } = await getSupabaseAdmin().storage
      .from("students")
      .upload(path, buffer, { contentType: imageFile.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = getSupabaseAdmin().storage
      .from("students")
      .getPublicUrl(path);

    const { data, error } = await getSupabaseAdmin()
      .from("featured_students")
      .insert({
        name,
        grade,
        country,
        image_url:   urlData.publicUrl,
        youtube_url: youtubeUrl,
        featured,
        sort_order:  isNaN(sortOrder) ? 0 : sortOrder,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[admin/students POST]", err);
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
  }
}
