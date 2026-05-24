"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import SectionTitle from "./ui/SectionTitle";
import { useLanguage } from "@/contexts/LanguageContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Difficulty = "Beginner" | "Intermediate" | "Advanced";

interface Project {
  id: string;
  category: string;
  title: string;
  description: string;
  tech: string[];
  difficulty: Difficulty;
  ageGroup: string;
  accent: "orange" | "navy";
  icon: React.ReactNode;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const PROJECTS: Project[] = [
  {
    id: "ai-assistant",
    category: "AI Project",
    title: "Smart AI Assistant",
    description:
      "Students built a fully functional AI-powered assistant using prompt engineering, automation workflows, and natural language processing.",
    tech: ["Python", "OpenAI API", "Automation"],
    difficulty: "Advanced",
    ageGroup: "Ages 14–17",
    accent: "navy",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
        <rect x="8" y="14" width="32" height="22" rx="4" />
        <circle cx="18" cy="25" r="2.5" />
        <circle cx="30" cy="25" r="2.5" />
        <path d="M18 32c1.5 2 10.5 2 12 0" />
        <path d="M16 14v-4M32 14v-4M20 14v-2M28 14v-2" />
      </svg>
    ),
  },
  {
    id: "robot-car",
    category: "Robotics",
    title: "Smart Robot Car",
    description:
      "An autonomous robot with ultrasonic obstacle avoidance, line-following sensors, and Bluetooth remote control — built and programmed entirely by students.",
    tech: ["Arduino", "C++", "Sensors"],
    difficulty: "Intermediate",
    ageGroup: "Ages 10–14",
    accent: "orange",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
        <rect x="8" y="16" width="32" height="18" rx="4" />
        <circle cx="14" cy="36" r="4" />
        <circle cx="34" cy="36" r="4" />
        <path d="M18 36h12" />
        <path d="M16 20h4M28 20h4" />
        <path d="M24 16v-4M20 12h8" />
        <circle cx="24" cy="25" r="3" />
      </svg>
    ),
  },
  {
    id: "roblox-game",
    category: "Game Development",
    title: "Roblox Adventure Game",
    description:
      "A complete obstacle course game with custom mechanics, collectibles, checkpoints, and leaderboards — scripted in Lua using Roblox Studio.",
    tech: ["Roblox Studio", "Lua", "3D Design"],
    difficulty: "Intermediate",
    ageGroup: "Ages 9–13",
    accent: "navy",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
        <rect x="6" y="16" width="36" height="22" rx="4" />
        <circle cx="15" cy="27" r="4" />
        <circle cx="33" cy="27" r="2" />
        <circle cx="38" cy="22" r="2" />
        <circle cx="38" cy="32" r="2" />
        <circle cx="28" cy="27" r="2" />
        <path d="M6 22h-3M6 32h-3M42 22h3M42 32h3" />
      </svg>
    ),
  },
  {
    id: "vr-experience",
    category: "VR / Immersive Tech",
    title: "VR Learning Experience",
    description:
      "An immersive VR experience where students designed interactive 3D environments — from underwater worlds to space stations — using WebXR and A-Frame.",
    tech: ["A-Frame", "WebXR", "3D Modeling"],
    difficulty: "Advanced",
    ageGroup: "Ages 13–17",
    accent: "orange",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
        <path d="M6 24c0-4 3-8 8-8h20c5 0 8 4 8 8s-3 8-8 8H14c-5 0-8-4-8-8z" />
        <circle cx="17" cy="24" r="4" />
        <circle cx="31" cy="24" r="4" />
        <path d="M21 24h6" />
        <path d="M6 22l-4-2M42 22l4-2M6 26l-4 2M42 26l4 2" />
      </svg>
    ),
  },
  {
    id: "smart-website",
    category: "Web Development",
    title: "Smart Portfolio Website",
    description:
      "A fully responsive personal portfolio with animated sections, a contact form, and dark mode — built from scratch using HTML, CSS, and JavaScript.",
    tech: ["HTML", "CSS", "JavaScript"],
    difficulty: "Beginner",
    ageGroup: "Ages 11–15",
    accent: "navy",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
        <rect x="6" y="10" width="36" height="28" rx="4" />
        <path d="M6 18h36" />
        <circle cx="12" cy="14" r="1.5" />
        <circle cx="18" cy="14" r="1.5" />
        <circle cx="24" cy="14" r="1.5" />
        <path d="M12 26h8M12 31h12" />
        <rect x="26" y="22" width="12" height="12" rx="2" />
      </svg>
    ),
  },
  {
    id: "minecraft-world",
    category: "Minecraft Education",
    title: "Minecraft Interactive World",
    description:
      "Students engineered a custom Minecraft Education world with redstone logic gates, automated farms, and hidden puzzles — combining engineering with creative design.",
    tech: ["Minecraft EDU", "Redstone", "Engineering"],
    difficulty: "Beginner",
    ageGroup: "Ages 7–12",
    accent: "orange",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
        <rect x="10" y="10" width="12" height="12" rx="1" />
        <rect x="26" y="10" width="12" height="12" rx="1" />
        <rect x="10" y="26" width="12" height="12" rx="1" />
        <rect x="26" y="26" width="12" height="12" rx="1" />
        <path d="M22 16h4M16 22v4M32 22v4M22 32h4" />
      </svg>
    ),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Beginner:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  Intermediate: "bg-sky-50 text-sky-700 border-sky-200",
  Advanced:     "bg-orange-50 text-orange-700 border-orange-200",
};

// ── Card ──────────────────────────────────────────────────────────────────────

function ProjectCard({ project }: { project: Project }) {
  const isOrange = project.accent === "orange";

  const imageBg    = isOrange
    ? "from-[#FF8A1F] to-[#FFB15A]"
    : "from-[#0B1F3A] to-[#1E3A5F]";
  const iconGlow   = isOrange ? "rgba(255,138,31,0.4)" : "rgba(56,189,248,0.3)";
  const chipBg     = isOrange ? "bg-[#FF8A1F]/10 text-[#CC6A00]" : "bg-[#38BDF8]/10 text-[#0369A1]";
  const eyebrowClr = isOrange ? "text-[#FF8A1F]" : "text-[#38BDF8]";

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_2px_16px_rgba(11,31,58,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(11,31,58,0.12)]">

      {/* Image area */}
      <div className={`relative flex h-44 shrink-0 items-center justify-center overflow-hidden bg-linear-to-br ${imageBg}`}>

        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Glare */}
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

        {/* Icon */}
        <div
          className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-sm"
          style={{ boxShadow: `0 0 32px ${iconGlow}` }}
        >
          {project.icon}
        </div>

        {/* Difficulty badge */}
        <span className={`absolute left-3 top-3 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${DIFFICULTY_STYLES[project.difficulty]}`}>
          {project.difficulty}
        </span>

        {/* Age badge */}
        <span className="absolute right-3 top-3 inline-block rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          {project.ageGroup}
        </span>

        {/* Bottom orange bar — hover reveal */}
        <div className={`absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 ${isOrange ? "bg-[#FF8A1F]" : "bg-[#38BDF8]"}`} />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <p className={`text-[10px] font-bold uppercase tracking-[0.22em] ${eyebrowClr}`}>
          {project.category}
        </p>
        <h3 className="mt-2 text-base font-extrabold leading-snug text-[#0F172A]">
          {project.title}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
          {project.description}
        </p>

        {/* Tech chips */}
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {project.tech.map((t) => (
            <span key={t} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${chipBg}`}>
              {t}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function ProjectsSection() {
  const { t, dir } = useLanguage();
  const trackRef   = useRef<HTMLDivElement>(null);

  const scroll = (direction: "prev" | "next") => {
    const el = trackRef.current;
    if (!el) return;
    const forward = direction === "next" ? (dir === "rtl" ? -360 : 360) : (dir === "rtl" ? 360 : -360);
    el.scrollBy({ left: forward, behavior: "smooth" });
  };

  return (
    <section id="projects" className="relative z-10 pb-16 md:pb-24">

      {/* Header */}
      <div className="mx-auto max-w-7xl px-6">
        <SectionTitle
          eyebrow={t("projects.eyebrow")}
          heading={<>{t("projects.heading1")} <span className="text-[#FF8A1F]">{t("projects.heading2")}</span></>}
          body={t("projects.body")}
        />

        {/* Arrow controls — semantic prev/next, not left/right */}
        <div className="mt-8 flex items-center justify-end gap-2">
          <button
            onClick={() => scroll("prev")}
            aria-label="Previous"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#64748B] shadow-sm transition-all duration-200 hover:border-[#FF8A1F] hover:text-[#FF8A1F] hover:shadow-[0_2px_12px_rgba(255,138,31,0.18)]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}>
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={() => scroll("next")}
            aria-label="Next"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#64748B] shadow-sm transition-all duration-200 hover:border-[#FF8A1F] hover:text-[#FF8A1F] hover:shadow-[0_2px_12px_rgba(255,138,31,0.18)]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`}>
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Carousel track — full bleed with inner padding */}
      <div className="relative mt-6">

        {/* Fade-out on trailing edge (right in LTR, left in RTL) */}
        <div className={`pointer-events-none absolute inset-y-0 z-10 w-20 ${dir === "rtl" ? "left-0 bg-linear-to-r" : "right-0 bg-linear-to-l"} from-[#F8FAFC] to-transparent`} />

        <motion.div
          ref={trackRef}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth [-webkit-overflow-scrolling:touch] scrollbar-none [&::-webkit-scrollbar]:hidden"
        >
          {/* Left spacer — aligns first card with max-w-7xl content */}
          <div className="w-6 shrink-0 md:w-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]" aria-hidden />

          {PROJECTS.map((project) => (
            <div
              key={project.id}
              className="w-72.5 shrink-0 sm:w-80 snap-start"
            >
              <ProjectCard project={project} />
            </div>
          ))}

          {/* Right spacer */}
          <div className="w-6 shrink-0" aria-hidden />
        </motion.div>
      </div>

    </section>
  );
}
