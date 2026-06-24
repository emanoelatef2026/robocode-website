"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import SectionTitle from "./ui/SectionTitle";
import SectionEmptyState from "./ui/SectionEmptyState";
import { useLanguage } from "@/contexts/LanguageContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id:           string;
  title:        string;
  description:  string | null;
  technologies: string[] | null;
  image_url:    string | null;
  difficulty:   string | null;
  age_group:    string | null;
  featured:     boolean;
}

// ── Difficulty style map ──────────────────────────────────────────────────────

const DIFF_STYLE: Record<string, string> = {
  Beginner:     "bg-[#E7F8EE] text-[#15803D] border-[#A7F3D0]",
  Intermediate: "bg-sky-50 text-sky-700 border-sky-200",
  Advanced:     "bg-orange-50 text-orange-700 border-orange-200",
};

// ── Card ──────────────────────────────────────────────────────────────────────

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const accentCyan   = index % 2 === 0;
  const accentColor  = accentCyan ? "#38BDF8" : "#FF8A1F";
  const gradientFrom = accentCyan ? "from-[#0B1F3A]" : "from-[#7C2D12]";
  const gradientTo   = accentCyan ? "to-[#1E3A5F]"  : "to-[#C2410C]";
  const chipBg       = accentCyan ? "bg-[#38BDF8]/10 text-[#0369A1]" : "bg-[#FF8A1F]/10 text-[#C2410C]";

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_12px_rgba(11,31,58,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(11,31,58,0.11)]">

      {/* Image / placeholder */}
      <div className="relative h-44 shrink-0 overflow-hidden">
        {project.image_url ? (
          <Image
            src={project.image_url}
            alt={project.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="320px"
          />
        ) : (
          <div className={`flex h-full items-center justify-center bg-linear-to-br ${gradientFrom} ${gradientTo}`}>
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            <div
              className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm"
              style={{ boxShadow: `0 0 24px ${accentColor}50` }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 opacity-80">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {project.difficulty && (
            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${DIFF_STYLE[project.difficulty] ?? "bg-white/80 text-[#334155] border-white/40"}`}>
              {project.difficulty}
            </span>
          )}
        </div>
        {project.age_group && (
          <span className="absolute right-3 top-3 inline-block rounded-full border border-white/30 bg-black/30 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {project.age_group}
          </span>
        )}

        {/* Accent line on hover */}
        <div
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
          style={{ backgroundColor: accentColor }}
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[15px] font-extrabold leading-snug text-[#0F172A]">
          {project.title}
        </h3>
        {project.description && (
          <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[#64748B]">
            {project.description}
          </p>
        )}

        {/* Tech chips */}
        {project.technologies && project.technologies.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
            {project.technologies.map((tech) => (
              <span key={tech} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chipBg}`}>
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function ProjectsSection() {
  const { t, dir }                  = useLanguage();
  const trackRef                    = useRef<HTMLDivElement>(null);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [loading,  setLoading]      = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => { setProjects(Array.isArray(d) ? d : []); })
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
    <section id="projects" className="relative z-10 pb-16 md:pb-24">

      {/* Header */}
      <div className="mx-auto max-w-7xl px-6">
        <SectionTitle
          heading={<>{t("projects.heading1")} <span className="text-[#FF8A1F]">{t("projects.heading2")}</span></>}
          body={t("projects.body")}
        />

        {/* Arrow controls */}
        {!loading && projects.length > 0 && (
          <div className="mt-8 flex items-center justify-end gap-2">
            <button
              onClick={() => scroll("prev")}
              aria-label="Previous"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#64748B] shadow-sm transition-all duration-200 hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}>
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => scroll("next")}
              aria-label="Next"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#64748B] shadow-sm transition-all duration-200 hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}>
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-10 flex h-48 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#FF8A1F] border-t-transparent" />
        </div>
      ) : projects.length === 0 ? (
        <div className="mx-auto mt-10 max-w-7xl px-6">
          <SectionEmptyState
            variant="projects"
            heading="Projects coming soon"
            subtext="Student projects will appear here once added from the dashboard."
          />
        </div>
      ) : (
        <div className="relative mt-6">
          {/* Fade-out on trailing edge */}
          <div className={`pointer-events-none absolute inset-y-0 z-10 w-20 ${dir === "rtl" ? "left-0 bg-linear-to-r" : "right-0 bg-linear-to-l"} from-[#F8FAFC] to-transparent`} />

          <motion.div
            ref={trackRef}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4 [-webkit-overflow-scrolling:touch] scrollbar-none [&::-webkit-scrollbar]:hidden"
          >
            {/* Left spacer aligns first card with max-w-7xl */}
            <div className="w-6 shrink-0 md:w-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]" aria-hidden />

            {projects.map((project, i) => (
              <div key={project.id} className="w-72 shrink-0 snap-start sm:w-80">
                <ProjectCard project={project} index={i} />
              </div>
            ))}

            <div className="w-6 shrink-0" aria-hidden />
          </motion.div>
        </div>
      )}

    </section>
  );
}
