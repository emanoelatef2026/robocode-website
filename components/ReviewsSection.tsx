"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import PublicSectionTitle from "./public-site/PublicSectionTitle";
import SectionEmptyState from "@/components/ui/SectionEmptyState";

interface Review {
  id:        string;
  name:      string;
  role:      string | null;
  review:    string;
  image_url: string | null;
  rating:    number | null;
  branch:    string | null;
}

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 16 16"
          fill={n <= Math.round(rating) ? "var(--orange-strong)" : "none"}
          stroke={n <= Math.round(rating) ? "var(--orange-strong)" : "var(--muted)"}
          strokeWidth="1.5"
          className="h-3.5 w-3.5"
        >
          <path d="M8 1.5l1.545 3.13 3.455.503-2.5 2.437.59 3.44L8 9.385l-3.09 1.625.59-3.44L3 5.133l3.455-.503z" />
        </svg>
      ))}
    </div>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────

function ReviewCard({ review, index }: { review: Review; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="group flex w-72 shrink-0 snap-start flex-col rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card)] sm:w-80"
    >
      {/* Rating */}
      {review.rating != null && (
        <div className="mb-3">
          <Stars rating={review.rating} />
        </div>
      )}

      {/* Review text */}
      <p className="flex-1 text-[13px] leading-relaxed text-[var(--text-2)] line-clamp-5">
        &ldquo;{review.review}&rdquo;
      </p>

      {/* Author row */}
      <div className="mt-4 flex items-center gap-3 border-t border-[var(--bg-muted)] pt-4">
        {review.image_url ? (
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--border)]">
            <Image
              src={review.image_url}
              alt={review.name}
              fill
              sizes="36px"
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--navy)]/8 text-[13px] font-bold text-[var(--navy)]">
            {review.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-[var(--text)]">{review.name}</p>
          {(review.role || review.branch) && (
            <p className="truncate text-[11px] text-[var(--muted)]">
              {[review.role, review.branch].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function ReviewsSection() {
  const { t, dir }                = useLanguage();
  const trackRef                  = useRef<HTMLDivElement>(null);
  const [reviews,  setReviews]    = useState<Review[]>([]);
  const [loading,  setLoading]    = useState(true);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => r.json())
      .then((d) => setReviews(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const scroll = (direction: "prev" | "next") => {
    const el = trackRef.current;
    if (!el) return;
    const forward = direction === "next" ? (dir === "rtl" ? -340 : 340) : (dir === "rtl" ? 340 : -340);
    el.scrollBy({ left: forward, behavior: "smooth" });
  };

  return (
    <section id="reviews" className="relative z-10 pb-16 md:pb-24">

      <div className="mx-auto max-w-7xl px-6">
        <PublicSectionTitle section="reviews" />

        {!loading && reviews.length > 0 && (
          <div className="mt-8 flex items-center justify-end gap-2">
            <button
              onClick={() => scroll("prev")}
              aria-label="Previous"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--text-3)] shadow-sm transition-all duration-200 hover:border-[var(--orange-strong)] hover:text-[var(--orange-strong)]"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}>
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => scroll("next")}
              aria-label="Next"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--text-3)] shadow-sm transition-all duration-200 hover:border-[var(--orange-strong)] hover:text-[var(--orange-strong)]"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}>
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-10 flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--orange-strong)] border-t-transparent" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="mx-auto mt-10 max-w-7xl px-6">
          <SectionEmptyState
            variant="generic"
            heading="Reviews coming soon"
            subtext="Parent and student reviews will appear here once added."
          />
        </div>
      ) : (
        <div className="relative mt-6">
          <div className={`pointer-events-none absolute inset-y-0 z-10 w-20 ${dir === "rtl" ? "left-0 bg-linear-to-r" : "right-0 bg-linear-to-l"} from-[var(--bg)] to-transparent`} />
          <div
            ref={trackRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [-webkit-overflow-scrolling:touch] scrollbar-none [&::-webkit-scrollbar]:hidden"
          >
            <div className="w-6 shrink-0 md:w-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]" aria-hidden />
            {reviews.map((review, i) => (
              <ReviewCard key={review.id} review={review} index={i} />
            ))}
            <div className="w-6 shrink-0" aria-hidden />
          </div>
        </div>
      )}
    </section>
  );
}
