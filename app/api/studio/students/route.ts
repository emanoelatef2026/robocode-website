import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

// DB columns: id, name, grade, country, image_url, youtube_url, featured,
//             sort_order, created_at, achievement_title, achievement_description

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("featured_students")
      .select("id, name, image_url, achievement_title, achievement_description, youtube_url, featured, sort_order, created_at")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[studio/students GET] table=featured_students error_code=%s message=%s", error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[studio/students GET] unexpected:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const fd                = await request.formData();
    const imageFile         = fd.get("image") as File | null;
    const name              = (fd.get("name")                    as string)?.trim();
    const achievementTitle  = (fd.get("achievement_title")       as string)?.trim() || null;
    const achievementDesc   = (fd.get("achievement_description") as string)?.trim() || null;
    const youtubeUrl        = (fd.get("youtube_url")             as string)?.trim() || null;
    const sortOrder         = parseInt((fd.get("sort_order")     as string) ?? "0", 10);
    const featured          = fd.get("featured") !== "false";

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

    const { error: uploadErr } = await getSupabaseAdmin().storage
      .from("students")
      .upload(path, buffer, { contentType: imageFile.type, upsert: false });

    if (uploadErr) {
      console.error("[studio/students POST] storage upload error:", uploadErr.message);
      throw uploadErr;
    }

    const { data: urlData } = getSupabaseAdmin().storage.from("students").getPublicUrl(path);

    const { data, error } = await getSupabaseAdmin()
      .from("featured_students")
      .insert({
        name,
        image_url:               urlData.publicUrl,
        achievement_title:       achievementTitle,
        achievement_description: achievementDesc,
        youtube_url:             youtubeUrl,
        featured,
        sort_order:              isNaN(sortOrder) ? 0 : sortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error("[studio/students POST] table=featured_students error_code=%s message=%s", error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[studio/students POST] unexpected:", err);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
