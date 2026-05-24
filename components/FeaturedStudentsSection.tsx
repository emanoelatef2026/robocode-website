"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionEmptyState from "@/components/ui/SectionEmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Student {
  id:          string;
  name:        string;
  grade:       string;
  country:     string;
  image_url:   string;
  youtube_url: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&\n?#]{8,12})/
  );
  return match?.[1] ?? null;
}

// ── Student card ──────────────────────────────────────────────────────────────

function StudentCard({
  student,
  onClick,
}: {
  student: Student;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="group w-44 shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-white shadow-[0_2px_16px_rgba(11,31,58,0.10)] transition-shadow duration-300 hover:shadow-[0_8px_28px_rgba(11,31,58,0.16)] sm:w-48 md:w-52"
    >
      {/* Image — clean, no overlay clutter */}
      <div className="relative w-full overflow-hidden bg-[#E2E8F0]" style={{ aspectRatio: "3/4" }}>
        <Image
          src={student.image_url}
          alt={student.name}
          fill
          sizes="208px"
          className="object-cover transition-transform duration-500 group-hover:scale-104"
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-3 bg-[#0B1F3A] px-3.5 py-3">
        {/* Play button */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#38BDF8]/40 bg-[#38BDF8]/15 transition-all duration-200 group-hover:border-[#38BDF8] group-hover:bg-[#38BDF8]">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 translate-x-px text-[#38BDF8] transition-colors duration-200 group-hover:text-white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 text-start">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-[#38BDF8]">
            Watch Video
          </p>
          <p className="truncate text-[12px] font-bold leading-tight text-white">
            {student.name}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function VideoModal({
  student,
  onClose,
}: {
  student: Student;
  onClose: () => void;
}) {
  const videoId = extractYouTubeId(student.youtube_url);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1,   opacity: 1, y: 0  }}
        exit={{    scale: 0.9, opacity: 0, y: 20  }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-xs overflow-hidden rounded-3xl bg-[#0B132B] shadow-2xl sm:max-w-sm"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {videoId ? (
          <div className="relative w-full" style={{ aspectRatio: "9/16" }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={`${student.name} — Robocode`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        ) : (
          <div className="flex aspect-9/16 items-center justify-center text-sm text-white/40">
            Invalid video URL
          </div>
        )}

        <div className="border-t border-white/8 px-5 py-3.5">
          <p className="font-bold text-white" style={{ fontFamily: "var(--font-orbitron), sans-serif" }}>
            {student.name}
          </p>
          <p className="mt-0.5 text-[13px] text-white/50">
            {student.grade} &nbsp;·&nbsp; {student.country}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Marquee track ─────────────────────────────────────────────────────────────

function MarqueeTrack({
  students,
  onSelect,
}: {
  students: Student[];
  onSelect: (s: Student) => void;
}) {
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(0);
  const items   = [...students, ...students];
  const duration = Math.max(20, students.length * 5);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchMove={() => setPaused(true)}
      onTouchEnd={() => { setTimeout(() => setPaused(false), 1200); }}
    >
      <div
        className="flex"
        style={{
          gap: "16px",
          animation: `marquee ${duration}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
          width: "max-content",
        }}
      >
        {items.map((student, i) => (
          <StudentCard
            key={`${student.id}-${i}`}
            student={student}
            onClick={() => onSelect(student)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function FeaturedStudentsSection() {
  const { t }                   = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [active,   setActive]   = useState<Student | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/students")
      .then((r) => r.json())
      .then((d) => { setStudents(Array.isArray(d) ? d : []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="featured-students" className="relative z-10 overflow-hidden py-16 md:py-24">

      <div className="pointer-events-none absolute left-1/3 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[#FF8A1F]/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#0B1F3A]/4 blur-3xl" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mb-10 max-w-7xl px-6 text-center md:mb-12"
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#FF8A1F]">
          {t("featuredStudents.eyebrow")}
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0F172A] md:text-5xl lg:text-[3.5rem]">
          {t("featuredStudents.heading1")}{" "}
          <span className="text-[#FF8A1F]">{t("featuredStudents.heading2")}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#64748B] md:text-base">
          {t("featuredStudents.body")}
        </p>
        <div className="mx-auto mt-5 h-0.75 w-12 rounded-full bg-[#FF8A1F]" />
      </motion.div>

      {/* Marquee */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
        </div>
      ) : students.length === 0 ? (
        <div className="mx-auto max-w-7xl px-6">
          <SectionEmptyState
            variant="students"
            heading="Student spotlights coming soon"
            subtext="Our featured students and their projects will appear here."
          />
        </div>
      ) : (
        <MarqueeTrack students={students} onSelect={setActive} />
      )}

      {/* Modal */}
      <AnimatePresence>
        {active && (
          <VideoModal student={active} onClose={() => setActive(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}
