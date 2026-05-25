import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://robocode.school";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlogPost {
  id:               string;
  title:            string;
  slug:             string;
  excerpt:          string | null;
  content:          string;
  featured_image:   string | null;
  category:         string;
  author:           string;
  seo_title:        string | null;
  meta_description: string | null;
  og_image:         string | null;
  published_at:     string | null;
  updated_at:       string | null;
}

// ── Data fetch helper ─────────────────────────────────────────────────────────

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const { data } = await getSupabaseAdmin()
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();
    return data ?? null;
  } catch {
    return null;
  }
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const post     = await getPost(slug);
  if (!post) return { title: "Post Not Found | Robocode Blog" };

  const title       = post.seo_title        || post.title;
  const description = post.meta_description || post.excerpt || "";
  const ogImage     = post.og_image         || post.featured_image;

  return {
    title:       `${title} | Robocode Blog`,
    description,
    alternates:  { canonical: `${BASE}/blog/${slug}` },
    openGraph: {
      title,
      description,
      url:           `${BASE}/blog/${slug}`,
      type:          "article",
      publishedTime: post.published_at  ?? undefined,
      modifiedTime:  post.updated_at    ?? undefined,
      authors:       [post.author],
      images:        ogImage ? [{ url: ogImage, width: 1200, height: 630, alt: title }] : [],
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description,
      images:      ogImage ? [ogImage] : [],
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BlogPostPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const post     = await getPost(slug);
  if (!post) notFound();

  const articleSchema = {
    "@context":        "https://schema.org",
    "@type":           "Article",
    headline:          post.title,
    description:       post.excerpt ?? "",
    image:             post.featured_image ?? "",
    author:            { "@type": "Person", name: post.author },
    publisher:         {
      "@type":  "Organization",
      name:     "Robocode School",
      logo:     { "@type": "ImageObject", url: `${BASE}/logo.png` },
    },
    datePublished:     post.published_at ?? "",
    dateModified:      post.updated_at   ?? post.published_at ?? "",
    mainEntityOfPage:  { "@type": "WebPage", "@id": `${BASE}/blog/${slug}` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <div className="min-h-screen bg-[#F8FAFC]">
        <Navbar />

        <main className="mx-auto max-w-3xl px-6 pb-24 pt-28">
          {/* Back link */}
          <Link
            href="/blog"
            className="mb-8 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#64748B] transition-colors duration-200 hover:text-[#0B1F3A]"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path fillRule="evenodd" d="M9.707 4.293a1 1 0 010 1.414L7.414 8l2.293 2.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Back to Blog
          </Link>

          {/* Category + date */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#38BDF8]/12 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0B1F3A]">
              {post.category}
            </span>
            {post.published_at && (
              <span className="text-[12px] text-[#94A3B8]">
                {new Date(post.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            )}
            <span className="text-[12px] text-[#94A3B8]">By {post.author}</span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-extrabold leading-snug tracking-tight text-[#0F172A] md:text-4xl">
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="mt-4 text-[16px] leading-relaxed text-[#64748B]">{post.excerpt}</p>
          )}

          {/* Featured image */}
          {post.featured_image && (
            <div className="relative mt-8 h-64 overflow-hidden rounded-2xl md:h-80">
              <Image
                src={post.featured_image}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Content */}
          <div
            className="blog-content mt-8"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Bottom author card */}
          <div className="mt-14 border-t border-[#E2E8F0] pt-8">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B1F3A]/8 text-[14px] font-bold text-[#0B1F3A]">
                {post.author.charAt(0)}
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#0F172A]">{post.author}</p>
                <p className="text-[12px] text-[#94A3B8]">Robocode School</p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#334155] shadow-sm transition-all duration-200 hover:border-[#38BDF8] hover:text-[#0B1F3A]"
            >
              ← More articles
            </Link>
          </div>
        </main>
      </div>

      <Footer />
    </>
  );
}
