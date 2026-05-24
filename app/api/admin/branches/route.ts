import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("branches")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/branches GET]", err);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const name       = (formData.get("name")     as string)?.trim();
    const phone      = (formData.get("phone")    as string)?.trim() || null;
    const location   = (formData.get("location") as string)?.trim() || null;
    const sort_order = parseInt((formData.get("sort_order") as string) || "0", 10);
    const active     = formData.get("active") !== "false";
    const imageFile  = formData.get("image") as File | null;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let image_url: string | null = null;

    if (imageFile && imageFile.size > 0) {
      const bytes  = await imageFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;

      const { error: uploadError } = await getSupabaseAdmin().storage
        .from("branches")
        .upload(path, buffer, { contentType: imageFile.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = getSupabaseAdmin().storage
        .from("branches")
        .getPublicUrl(path);

      image_url = urlData.publicUrl;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("branches")
      .insert({ name, phone, location, image_url, sort_order, active })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[admin/branches POST]", err);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}
