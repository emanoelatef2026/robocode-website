import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await request.json() as Record<string, unknown>;
    const allowed = ["title", "slug", "excerpt", "content", "category", "author", "seo_title", "meta_description", "og_image", "status", "published_at"];
    const update: Record<string, unknown> = {};
    for (const k of allowed) { if (k in body) update[k] = body[k]; }

    if (update.status === "published" && !update.published_at) {
      update.published_at = new Date().toISOString();
    }

    const { data, error } = await getSupabaseAdmin()
      .from("blog_posts").update(update).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/blog PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error } = await getSupabaseAdmin().from("blog_posts").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/blog DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
