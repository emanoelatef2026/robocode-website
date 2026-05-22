import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("gallery")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[gallery GET]", err);
    return NextResponse.json({ error: "Failed to fetch gallery" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData  = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const title     = (formData.get("title")    as string)?.trim() || null;
    const category  = (formData.get("category") as string)?.trim() || null;
    const alt_text  = title;

    if (!imageFile || imageFile.size === 0) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const bytes  = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

    const { error: uploadError } = await getSupabaseAdmin().storage
      .from("gallery")
      .upload(path, buffer, { contentType: imageFile.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = getSupabaseAdmin().storage
      .from("gallery")
      .getPublicUrl(path);

    const { data, error } = await getSupabaseAdmin()
      .from("gallery")
      .insert({ title, image_url: urlData.publicUrl, alt_text, category })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[gallery POST]", err);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
