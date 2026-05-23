"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";

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

// ── Play button overlay ───────────────────────────────────────────────────────

function PlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
      <motion.div
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-2xl backdrop-blur-sm"
      >
        <svg viewBox="0 0 24 24" fill="#0B132B" className="h-7 w-7 translate-x-0.5">
          <path d="M8 5v14l11-7z" />
        </svg>
      </motion.div>

      {/* Pulsing ring */}
      <span className="absolute h-16 w-16 animate-ping rounded-full bg-white/30" />
    </div>
  );
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
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="group relative w-[200px] shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-white shadow-lg sm:w-[220px] md:w-[240px]"
    >
      {/* Image — portrait aspect ratio */}
      <div className="relative w-full overflow-hidden bg-gray-100" style={{ aspectRatio: "3/4" }}>
        <Image
          src={student.image_url}
          alt={student.name}
          fill
          sizes="240px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B132B]/85 via-[#0B132B]/20 to-transparent" />

        {/* Play overlay */}
        <PlayOverlay />

        {/* Country flag + info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#19C6F4]">
            {student.country}
          </p>
          <p className="mt-1 font-bold leading-tight text-white" style={{ fontFamily: "var(--font-orbitron), sans-serif" }}>
            {student.name}
          </p>
          <p className="mt-0.5 text-xs text-white/60">{student.grade}</p>
        </div>

        {/* Top-right play badge */}
        <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/20 backdrop-blur-sm transition-all duration-300 group-hover:bg-[#19C6F4] group-hover:border-[#19C6F4]">
          <svg viewBox="0 0 24 24" fill="white" className="h-3.5 w-3.5 translate-x-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll while modal is open
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Panel */}
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{    scale: 0.88, opacity: 0, y: 24  }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-xs overflow-hidden rounded-3xl bg-[#0B132B] shadow-2xl sm:max-w-sm"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* YouTube embed — 9:16 Shorts ratio */}
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
          <div className="flex aspect-[9/16] items-center justify-center text-sm text-white/40">
            Invalid video URL
          </div>
        )}

        {/* Student info strip */}
        <div className="border-t border-white/8 px-5 py-4">
          <p
            className="font-bold text-white"
            style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
          >
            {student.name}
          </p>
          <p className="mt-0.5 text-sm text-white/50">
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

  // Duplicate for seamless loop
  const items = [...students, ...students];

  // Duration scales with content: ~4 s per card, min 20 s
  const duration = Math.max(20, students.length * 5);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
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
          gap: "20px",
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

  if (!loading && students.length === 0) return null;

  return (
    <section id="featured-students" className="relative z-10 overflow-hidden py-16 md:py-28">

      {/* Background decoration */}
      <div className="pointer-events-none absolute left-1/3 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[#19C6F4]/8 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-80 w-80 rounded-full bg-[#F97316]/6 blur-3xl" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mb-10 max-w-7xl px-6 text-center md:mb-14"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#19C6F4]">
          Tech Leaders
        </p>
        <h2 className="mt-4 text-3xl font-bold text-[#0B132B] md:text-5xl lg:text-6xl">
          Featured{" "}
          <span className="bg-linear-to-r from-[#19C6F4] to-[#F97316] bg-clip-text text-transparent">
            Students
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 md:text-lg">
          Meet the builders, innovators, and creators shaping the future — straight from our classrooms.
        </p>
        <div className="mx-auto mt-6 h-px w-20 bg-linear-to-r from-[#19C6F4] to-[#F97316]" />
      </motion.div>

      {/* Marquee */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#19C6F4] border-t-transparent" />
        </div>
      ) : (
        <MarqueeTrack students={students} onSelect={setActive} />
      )}

      {/* Hint text */}
      {!loading && students.length > 0 && (
        <p className="mt-6 text-center text-xs text-slate-400">
          Click any card to watch the video
        </p>
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
