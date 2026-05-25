import type { MetadataRoute } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://robocode.school";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const static_routes: MetadataRoute.Sitemap = [
    { url: BASE,                       lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/blog`,             lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE}/book-session`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];

  try {
    const { data: posts } = await getSupabaseAdmin()
      .from("blog_posts")
      .select("slug, updated_at")
      .eq("status", "published");

    const blog_routes: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
      url:             `${BASE}/blog/${p.slug}`,
      lastModified:    p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority:        0.7,
    }));

    return [...static_routes, ...blog_routes];
  } catch {
    return static_routes;
  }
}
