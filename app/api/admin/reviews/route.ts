import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("reviews")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[admin/reviews GET]", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const fd        = await request.formData();
    const imageFile = fd.get("image") as File | null;
    const name      = (fd.get("name")   as string)?.trim();
    const role      = (fd.get("role")   as string)?.trim() || null;
    const review    = (fd.get("review") as string)?.trim();
    const branch    = (fd.get("branch") as string)?.trim() || null;
    const rating    = parseFloat((fd.get("rating") as string) ?? "5");
    const sortOrder = parseInt((fd.get("sort_order") as string) ?? "0", 10);
    const active    = fd.get("active") !== "false";

    if (!name)   return NextResponse.json({ error: "Name required" },   { status: 400 });
    if (!review) return NextResponse.json({ error: "Review required" }, { status: 400 });

    let image_url: string | null = null;
    if (imageFile && imageFile.size > 0) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;
      const { error: uploadErr } = await getSupabaseAdmin().storage
        .from("reviews")
        .upload(path, buffer, { contentType: imageFile.type, upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = getSupabaseAdmin().storage.from("reviews").getPublicUrl(path);
      image_url = urlData.publicUrl;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("reviews")
      .insert({ name, role, review, image_url, rating: isNaN(rating) ? 5 : rating, branch, active, sort_order: isNaN(sortOrder) ? 0 : sortOrder })
      .select().single();
    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[admin/reviews POST]", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
