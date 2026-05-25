import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("blog_posts")
      .select("id, title, slug, excerpt, featured_image, category, author, published_at, created_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch {
    return NextResponse.json([]);
  }
}