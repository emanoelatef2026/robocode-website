"use client";
import PublicSectionTitle from "./public-site/PublicSectionTitle";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import SectionEmptyState from "@/components/ui/SectionEmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Student {
  id:                      string;
  name:                    string;
  image_url:               string;
  achievement_title:       string | null;
  achievement_description: string | null;
  youtube_url:             string | null;
}

// ── Student card ──────────────────────────────────────────────────────────────

function StudentCard({ student }: { student: Student }) {
  return (
    <div className="group w-52 shrink-0 overflow-hidden rounded-[var(--radius-xl)] bg-white shadow-[var(--shadow-card)] transition-shadow duration-300 hover:shadow-[var(--shadow-card)] sm:w-56">

      {/* Portrait photo — 3:4 */}
      <div className="relative w-full overflow-hidden bg-[var(--border)]" style={{ aspectRatio: "3/4" }}>
        <Image
          src={student.image_url}
          alt={student.name}
          fill
          sizes="224px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Info panel */}
      <div className="bg-[var(--navy)] px-4 py-3.5">
        <p className="truncate text-[13px] font-extrabold text-white">{student.name}</p>

        {student.achievement_title && (
          <p className="mt-0.5 truncate text-[11px] font-semibold text-[var(--cyan-strong)]">
            {student.achievement_title}
          </p>
        )}

        {student.achievement_description && (
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-white/60">
            {student.achievement_description}
          </p>
        )}

        {student.youtube_url && (
          <a
            href={student.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[var(--cyan-strong)]/40 px-3 py-1 text-[10px] font-bold text-[var(--cyan-strong)] transition-all duration-200 hover:border-[var(--cyan-strong)] hover:bg-[var(--cyan-strong)]/10"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
            View Project
          </a>
        )}
      </div>
    </div>
  );
}

// ── Marquee track ─────────────────────────────────────────────────────────────

function MarqueeTrack({ students }: { students: Student[] }) {
  const [paused, setPaused] = useState(false);
  const copies   = students.length < 3 ? 4 : 2;
  const track    = Array.from({ length: copies }, () => students).flat();
  const duration = Math.max(20, students.length * 6);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchMove={() => setPaused(true)}
      onTouchEnd={() => { setTimeout(() => setPaused(false), 1200); }}
    >
      <div
        className="flex gap-4"
        style={{
          width:              "max-content",
          animation:          `marquee ${duration}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
          willChange:         "transform",
        }}
      >
        {track.map((student, i) => (
          <StudentCard key={`${student.id}-${i}`} student={student} />
        ))}
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function FeaturedStudentsSection() {
  const { t }                   = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/students")
      .then((r) => r.json())
      .then((d) => { setStudents(Array.isArray(d) ? d : []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="featured-students" className="relative z-10 overflow-hidden pb-16 md:pb-24">

      <div className="pointer-events-none absolute left-1/3 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-[var(--orange-strong)]/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[var(--navy)]/4 blur-3xl" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mb-10 max-w-7xl px-6 text-center"
      >
        <PublicSectionTitle section="students" />
      </motion.div>

      {/* Marquee */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--orange-strong)] border-t-transparent" />
        </div>
      ) : students.length === 0 ? (
        <div className="mx-auto max-w-7xl px-6">
          <SectionEmptyState
            variant="students"
            heading="Student spotlights coming soon"
            subtext="Our featured students and their achievements will appear here."
          />
        </div>
      ) : (
        <MarqueeTrack students={students} />
      )}
    </section>
  );
}
