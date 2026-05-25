import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("blog_posts")
      .select("id, title, slug, status, category, author, published_at, created_at, featured_image")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[admin/blog GET]", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const fd             = await request.formData();
    const imageFile      = fd.get("featured_image") as File | null;
    const title          = (fd.get("title")            as string)?.trim();
    const slug           = (fd.get("slug")             as string)?.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const excerpt        = (fd.get("excerpt")          as string)?.trim() || null;
    const content        = (fd.get("content")          as string)?.trim() || "";
    const category       = (fd.get("category")         as string)?.trim() || "General";
    const author         = (fd.get("author")           as string)?.trim() || "Robocode";
    const seo_title      = (fd.get("seo_title")        as string)?.trim() || null;
    const meta_desc      = (fd.get("meta_description") as string)?.trim() || null;
    const og_image_url   = (fd.get("og_image_url")     as string)?.trim() || null;
    const status         = (fd.get("status")           as string) === "published" ? "published" : "draft";
    const published_at   = status === "published" ? new Date().toISOString() : null;

    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    if (!slug)  return NextResponse.json({ error: "Slug required" },  { status: 400 });

    let featured_image: string | null = null;
    if (imageFile && imageFile.size > 0) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const path   = `${Date.now()}-${imageFile.name.replace(/\s+/g, "-")}`;
      const { error: uploadErr } = await getSupabaseAdmin().storage
        .from("blog")
        .upload(path, buffer, { contentType: imageFile.type, upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = getSupabaseAdmin().storage.from("blog").getPublicUrl(path);
      featured_image = urlData.publicUrl;
    }

    const { data, error } = await getSupabaseAdmin()
      .from("blog_posts")
      .insert({ title, slug, excerpt, content, category, author, seo_title, meta_description: meta_desc, og_image: og_image_url ?? featured_image, featured_image, status, published_at })
      .select().single();
    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[admin/blog POST]", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
