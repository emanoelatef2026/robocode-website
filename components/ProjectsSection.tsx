"use client";

import { motion } from "framer-motion";

// ── Data ──────────────────────────────────────────────────────────────────────

type Difficulty = "Beginner" | "Intermediate" | "Advanced";
type Accent = "cyan" | "orange";

interface Project {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  tech: string[];
  difficulty: Difficulty;
  ageGroup: string;
  accent: Accent;
  featured: boolean;
  icon: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
}

const PROJECTS: Project[] = [
  {
    id: "ai-assistant",
    eyebrow: "AI Project",
    title: "Smart AI Assistant",
    description:
      "Students built a fully functional AI-powered assistant using prompt engineering, automation workflows, and natural language processing — capable of answering questions, generating content, and automating tasks.",
    tech: ["Python", "OpenAI API", "Automation"],
    difficulty: "Advanced",
    ageGroup: "Ages 14–17",
    accent: "cyan",
    featured: true,
    gradientFrom: "#19C6F4",
    gradientTo: "#6366f1",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12">
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
    eyebrow: "Robotics",
    title: "Smart Robot Car",
    description:
      "An autonomous robot vehicle with ultrasonic obstacle avoidance, line-following sensors, and Bluetooth remote control — programmed entirely by students using Arduino C++.",
    tech: ["Arduino", "C++", "Sensors"],
    difficulty: "Intermediate",
    ageGroup: "Ages 10–14",
    accent: "orange",
    featured: false,
    gradientFrom: "#F97316",
    gradientTo: "#f59e0b",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12">
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
    eyebrow: "Game Development",
    title: "Roblox Adventure Game",
    description:
      "A complete obstacle course (obby) game with custom mechanics, collectibles, checkpoints, and leaderboards — scripted in Lua using Roblox Studio.",
    tech: ["Roblox Studio", "Lua", "3D Design"],
    difficulty: "Intermediate",
    ageGroup: "Ages 9–13",
    accent: "cyan",
    featured: false,
    gradientFrom: "#19C6F4",
    gradientTo: "#a855f7",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12">
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
    eyebrow: "VR / Immersive Tech",
    title: "VR Learning Experience",
    description:
      "An immersive virtual reality experience where students designed and built interactive 3D environments — from underwater worlds to space stations — using WebXR and A-Frame.",
    tech: ["A-Frame", "WebXR", "3D Modeling"],
    difficulty: "Advanced",
    ageGroup: "Ages 13–17",
    accent: "orange",
    featured: true,
    gradientFrom: "#F97316",
    gradientTo: "#ec4899",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12">
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
    eyebrow: "Web Development",
    title: "Smart Portfolio Website",
    description:
      "A fully responsive personal portfolio site with animated sections, a contact form, and dark mode — built from scratch using HTML, CSS, and JavaScript.",
    tech: ["HTML", "CSS", "JavaScript"],
    difficulty: "Beginner",
    ageGroup: "Ages 11–15",
    accent: "cyan",
    featured: false,
    gradientFrom: "#19C6F4",
    gradientTo: "#10b981",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12">
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
    eyebrow: "Minecraft Education",
    title: "Minecraft Interactive World",
    description:
      "Students engineered a custom Minecraft Education world with redstone logic gates, automated farms, and hidden puzzles — combining engineering thinking with creative design.",
    tech: ["Minecraft EDU", "Redstone", "Engineering"],
    difficulty: "Beginner",
    ageGroup: "Ages 7–12",
    accent: "orange",
    featured: true,
    gradientFrom: "#F97316",
    gradientTo: "#84cc16",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12">
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
  Beginner:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  Intermediate: "bg-cyan-100 text-cyan-700 border-cyan-200",
  Advanced:     "bg-orange-100 text-orange-700 border-orange-200",
};

// Static particle positions (SSR-safe, no Math.random)
const PARTICLES = [
  { cx: "20%", cy: "25%", r: 1.5, opacity: 0.35 },
  { cx: "75%", cy: "18%", r: 1,   opacity: 0.25 },
  { cx: "55%", cy: "70%", r: 2,   opacity: 0.2  },
  { cx: "10%", cy: "60%", r: 1.5, opacity: 0.3  },
  { cx: "85%", cy: "55%", r: 1,   opacity: 0.2  },
  { cx: "40%", cy: "85%", r: 1.5, opacity: 0.25 },
  { cx: "65%", cy: "40%", r: 1,   opacity: 0.15 },
  { cx: "30%", cy: "50%", r: 2,   opacity: 0.18 },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function ImageArea({ project, featured }: { project: Project; featured: boolean }) {
  const isCyan = project.accent === "cyan";
  const height = featured ? "h-52 lg:h-72" : "h-44 md:h-56";

  return (
    <div className={`relative ${height} overflow-hidden`}>
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${project.gradientFrom}dd, ${project.gradientTo}cc)`,
        }}
      />

      {/* Dot grid overlay */}
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Floating particles */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="white" opacity={p.opacity} />
        ))}
      </svg>

      {/* Glare top-right */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

      {/* Centered icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 text-white shadow-lg backdrop-blur-sm"
          style={{ boxShadow: `0 0 40px ${project.gradientFrom}66` }}
        >
          {project.icon}
        </div>
      </div>

      {/* Difficulty badge */}
      <div className="absolute left-4 top-4">
        <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-sm ${DIFFICULTY_STYLES[project.difficulty]}`}>
          {project.difficulty}
        </span>
      </div>

      {/* Age group badge */}
      <div className="absolute right-4 top-4">
        <span className="inline-block rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {project.ageGroup}
        </span>
      </div>
    </div>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const isCyan = project.accent === "cyan";
  const accentColor = isCyan ? "#19C6F4" : "#F97316";
  const colSpan = project.featured ? "lg:col-span-2" : "lg:col-span-1";

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: (index % 3) * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative overflow-hidden rounded-2xl bg-white shadow-xl transition-all duration-500 hover:-translate-y-1 md:rounded-3xl md:hover:-translate-y-2 ${colSpan}`}
    >
      {/* Animated border bar (bottom) */}
      <div
        className="absolute bottom-0 left-0 h-0.5 w-0 transition-all duration-500 group-hover:w-full"
        style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }}
      />

      {/* Image area */}
      <ImageArea project={project} featured={project.featured} />

      {/* Content */}
      <div className="p-6 md:p-8">
        <p
          className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: accentColor }}
        >
          {project.eyebrow}
        </p>
        <h3 className="mt-3 text-xl font-bold text-[#0B132B]">{project.title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{project.description}</p>

        {/* Tech chips */}
        <div className="mt-5 flex flex-wrap gap-2">
          {project.tech.map((t) => (
            <span
              key={t}
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: isCyan ? "rgba(25,198,244,0.08)" : "rgba(249,115,22,0.08)",
                color: accentColor,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function ProjectsSection() {
  return (
    <section id="projects" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-32">

      {/* Decorative background glow */}
      <div className="pointer-events-none absolute left-1/4 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 top-32 h-80 w-80 translate-x-1/2 rounded-full bg-[#F97316]/8 blur-3xl" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative text-center"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#19C6F4]">
          Student Projects
        </p>
        <h2 className="mt-4 text-4xl font-bold text-[#0B132B] md:text-6xl">
          Students Build{" "}
          <span className="bg-linear-to-r from-[#19C6F4] to-[#F97316] bg-clip-text text-transparent">
            Real Technology
          </span>
        </h2>
        <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-700">
          From AI tools and autonomous robots to immersive VR worlds — every project
          is designed, built, and shipped by our students.
        </p>

        {/* Dual-tone underline accent */}
        <div className="mx-auto mt-8 h-px w-24 bg-linear-to-r from-[#19C6F4] to-[#F97316]" />
      </motion.div>

      {/* Asymmetric grid */}
      <div className="relative mt-12 grid grid-cols-1 gap-5 md:mt-20 md:grid-cols-2 md:gap-8 lg:grid-cols-3">

        {/* Row 1: featured (col-2) + normal (col-1) */}
        <ProjectCard project={PROJECTS[0]} index={0} />
        <ProjectCard project={PROJECTS[1]} index={1} />

        {/* Row 2: normal (col-1) + featured (col-2) */}
        <ProjectCard project={PROJECTS[2]} index={2} />
        <ProjectCard project={PROJECTS[3]} index={3} />

        {/* Row 3: normal (col-1) + featured (col-2) */}
        <ProjectCard project={PROJECTS[4]} index={4} />
        <ProjectCard project={PROJECTS[5]} index={5} />

      </div>
    </section>
  );
}
