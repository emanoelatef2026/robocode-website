import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://robocode.school";

export const metadata: Metadata = {
  title: "Blog | Robocode School — AI, Robotics & Coding for Kids",
  description:
    "Explore articles, guides, and insights about teaching kids AI, robotics, game development, and programming from Robocode School.",
  alternates: { canonical: `${BASE}/blog` },
  openGraph: {
    title:       "Robocode Blog — Tech Education for Kids",
    description: "Explore articles about AI, robotics, and programming education for children.",
    url:         `${BASE}/blog`,
    type:        "website",
  },
};

interface Post {
  id:             string;
  title:          string;
  slug:           string;
  excerpt:        string | null;
  featured_image: string | null;
  category:       string;
  author:         string;
  published_at:   string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ── Blog card ─────────────────────────────────────────────────────────────────

function PostCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(11,31,58,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(11,31,58,0.11)] ${featured ? "md:flex-row" : ""}`}
    >
      {/* Image */}
      <div className={`relative shrink-0 overflow-hidden bg-[#E2E8F0] ${featured ? "h-52 md:h-auto md:w-80" : "h-44"}`}>
        {post.featured_image ? (
          <Image
            src={post.featured_image}
            alt={post.title}
            fill
            sizes={featured ? "(max-width: 768px) 100vw, 320px" : "400px"}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#0B1F3A] to-[#1E3A5F]">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 opacity-30">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-[#38BDF8]/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
          {post.category}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-1.5 text-[11px] font-semibold text-[#94A3B8]">
          {formatDate(post.published_at)} · {post.author}
        </p>
        <h2 className={`font-extrabold leading-snug text-[#0F172A] group-hover:text-[#0B1F3A] ${featured ? "text-xl" : "text-[15px]"}`}>
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[#64748B]">
            {post.excerpt}
          </p>
        )}
        <div className="mt-auto flex items-center gap-1.5 pt-4 text-[12px] font-semibold text-[#38BDF8]">
          Read article
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5">
            <path fillRule="evenodd" d="M6.293 4.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L8.586 8 6.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BlogPage() {
  let posts: Post[] = [];

  try {
    const { data } = await getSupabaseAdmin()
      .from("blog_posts")
      .select("id, title, slug, excerpt, featured_image, category, author, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    posts = data ?? [];
  } catch {
    // Table not created yet — show empty state
  }

  const [featured, ...rest] = posts;

  return (
    <>
      <div className="min-h-screen bg-[#F8FAFC]">
        <Navbar />

        <main className="mx-auto max-w-7xl px-6 pb-24 pt-28">
          {/* Header */}
          <div className="mb-12 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#38BDF8]">
              Robocode Insights
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0F172A] md:text-5xl">
              Tech Education{" "}
              <span className="text-[#FF8A1F]">Blog</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#64748B]">
              Guides, insights, and ideas to help kids learn AI, robotics, and programming.
            </p>
            <div className="mx-auto mt-5 h-0.5 w-12 rounded-full bg-[#38BDF8]" />
          </div>

          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B1F3A]/6">
                <svg viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                  <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <p className="text-[15px] font-semibold text-[#0B1F3A]">Articles coming soon</p>
              <p className="mt-2 text-[13px] text-[#94A3B8]">Our blog is being built. Check back soon for educational content.</p>
              <div className="mx-auto mt-5 h-0.5 w-10 rounded-full bg-[#38BDF8]/30" />
            </div>
          ) : (
            <div className="space-y-10">
              {/* Featured post */}
              {featured && <PostCard post={featured} featured />}

              {/* Grid of remaining posts */}
              {rest.length > 0 && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <Footer />
    </>
  );
}
