import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_KEYS = ["hero_image", "why_robocode_image"] as const;
type MediaKey = typeof VALID_KEYS[number];

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("site_media")
      .select("*")
      .order("key");

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[site-media GET]", err);
    return NextResponse.json({ error: "Failed to fetch site media" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const formData  = await request.formData();
    const key       = (formData.get("key") as string)?.trim() as MediaKey;
    const imageFile = formData.get("image") as File | null;

    if (!VALID_KEYS.includes(key)) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }
    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const bytes  = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const path   = `${key}/${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

    const { error: uploadError } = await getSupabaseAdmin().storage
      .from("site-media")
      .upload(path, buffer, { contentType: imageFile.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = getSupabaseAdmin().storage
      .from("site-media")
      .getPublicUrl(path);

    const { data, error } = await getSupabaseAdmin()
      .from("site_media")
      .upsert(
        { key, image_url: urlData.publicUrl, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[site-media PUT]", err);
    return NextResponse.json({ error: "Failed to upload media" }, { status: 500 });
  }
}
