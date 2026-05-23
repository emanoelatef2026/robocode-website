"use client";

import { motion } from "framer-motion";
import SectionTitle from "./ui/SectionTitle";

// ── Types ─────────────────────────────────────────────────────────────────────

type AccentColor = "cyan" | "orange";

interface ProgramData {
  id:          string;
  title:       string;
  description: string;
  ages:        string;
  accent:      AccentColor;
  tools:       string[];
  projects:    string[];
}

// ── Data ──────────────────────────────────────────────────────────────────────

const PROGRAMS: ProgramData[] = [
  {
    id: "ai",
    title: "AI & Automation",
    description:
      "Build intelligent tools, train AI models, and create smart automations using modern AI platforms and APIs.",
    ages: "10–17",
    accent: "cyan",
    tools: ["ChatGPT", "Python", "Make.com", "APIs"],
    projects: ["AI chatbot", "Image classifier", "Smart assistant"],
  },
  {
    id: "robotics",
    title: "Robotics Engineering",
    description:
      "Design, build, and program autonomous robots using sensors and code that solves real-world challenges.",
    ages: "7–16",
    accent: "orange",
    tools: ["Arduino", "LEGO Mindstorms", "C++", "Sensors"],
    projects: ["Maze-solver", "Line follower", "Battle bot"],
  },
  {
    id: "roblox",
    title: "Roblox Development",
    description:
      "Create fully playable multiplayer games using Roblox Studio and professional Lua scripting from scratch.",
    ages: "8–14",
    accent: "cyan",
    tools: ["Roblox Studio", "Lua", "3D Design", "Game Logic"],
    projects: ["Obby game", "RPG world", "Multiplayer map"],
  },
  {
    id: "python",
    title: "Python Programming",
    description:
      "Master the world's most powerful beginner language to build apps, automate tasks, and create real tools.",
    ages: "10–17",
    accent: "orange",
    tools: ["Python", "Pygame", "Tkinter", "Automation"],
    projects: ["2D game", "Quiz app", "Web scraper"],
  },
  {
    id: "gamedev",
    title: "Game Development",
    description:
      "Design and build 2D and 3D games with professional tools, learning physics, mechanics, and level design.",
    ages: "11–17",
    accent: "cyan",
    tools: ["Unity", "C#", "Scratch", "Physics Engine"],
    projects: ["Platformer", "Top-down shooter", "Puzzle game"],
  },
  {
    id: "web",
    title: "Web Development",
    description:
      "Build interactive websites and real web apps — from your first line of HTML to a deployed, live product.",
    ages: "12–17",
    accent: "orange",
    tools: ["HTML", "CSS", "JavaScript", "React"],
    projects: ["Portfolio", "Interactive UI", "Web app"],
  },
  {
    id: "minecraft",
    title: "Minecraft Modding",
    description:
      "Learn programming fundamentals through custom mods, adventure maps, and plugins inside Minecraft.",
    ages: "7–13",
    accent: "cyan",
    tools: ["Java", "MCreator", "Map Design", "Logic"],
    projects: ["Custom mod", "Adventure map", "Mini-game"],
  },
  {
    id: "vr",
    title: "VR & Innovation Lab",
    description:
      "Advanced students prototype bold ideas using immersive tech, 3D modeling, and future-forward design tools.",
    ages: "13–17",
    accent: "orange",
    tools: ["VR Design", "Blender", "3D Modeling", "Prototyping"],
    projects: ["VR world", "3D experience", "Innovation project"],
  },
];

// ── Accent design tokens ───────────────────────────────────────────────────────

const ACCENT: Record<AccentColor, {
  iconBg:      string;
  iconColor:   string;
  chipBg:      string;
  chipText:    string;
  dot:         string;
  bar:         string;
  wash:        string;
  glow:        string;
}> = {
  cyan: {
    iconBg:    "bg-[#0B1F3A]/8",
    iconColor: "text-[#0B1F3A]",
    chipBg:    "bg-[#0B1F3A]/8",
    chipText:  "text-[#0B1F3A]",
    dot:       "bg-[#0B1F3A]",
    bar:       "from-[#0B1F3A] to-[#163560]",
    wash:      "from-[#0B1F3A]",
    glow:      "group-hover:shadow-[0_20px_48px_rgba(11,31,58,0.10)]",
  },
  orange: {
    iconBg:    "bg-[#FF8A1F]/10",
    iconColor: "text-[#FF8A1F]",
    chipBg:    "bg-[#FF8A1F]/10",
    chipText:  "text-[#FF8A1F]",
    dot:       "bg-[#FF8A1F]",
    bar:       "from-[#FF8A1F] to-[#FFB15A]",
    wash:      "from-[#FF8A1F]",
    glow:      "group-hover:shadow-[0_20px_48px_rgba(255,138,31,0.14)]",
  },
};

// ── SVG icons ─────────────────────────────────────────────────────────────────

function ProgramIcon({ id, className }: { id: string; className: string }) {
  const base = {
    viewBox:          "0 0 24 24",
    fill:             "none",
    stroke:           "currentColor" as const,
    strokeWidth:      1.5,
    strokeLinecap:    "round" as const,
    strokeLinejoin:   "round" as const,
    className,
  };

  switch (id) {
    case "ai":
      return (
        <svg {...base}>
          {/* CPU / microchip */}
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M20 9h2M2 15h2M20 15h2" />
        </svg>
      );

    case "robotics":
      return (
        <svg {...base}>
          {/* Settings / gear */}
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );

    case "roblox":
      return (
        <svg {...base}>
          {/* Game controller */}
          <path d="M17 5H7a4 4 0 0 0-4 4v4a4 4 0 0 0 4 4h1l2 2h4l2-2h1a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4z" />
          <path d="M6 11h4M8 9v4" />
          <circle cx="16" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="16" cy="13" r="1" fill="currentColor" stroke="none" />
        </svg>
      );

    case "python":
      return (
        <svg {...base}>
          {/* Code brackets <> */}
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );

    case "gamedev":
      return (
        <svg {...base}>
          {/* Play circle */}
          <circle cx="12" cy="12" r="10" />
          <polygon
            points="10 8 16 12 10 16 10 8"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );

    case "web":
      return (
        <svg {...base}>
          {/* Globe */}
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      );

    case "minecraft":
      return (
        <svg {...base}>
          {/* 3D box / package */}
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );

    default: /* vr */
      return (
        <svg {...base}>
          {/* VR headset / goggles */}
          <path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9z" />
          <circle cx="9"  cy="12" r="2" />
          <circle cx="15" cy="12" r="2" />
          <path d="M11 12h2M8 7V5M16 7V5" />
        </svg>
      );
  }
}

// ── Card ──────────────────────────────────────────────────────────────────────

function ProgramCard({ program, index }: { program: ProgramData; index: number }) {
  const a = ACCENT[program.accent];

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{
        duration: 0.55,
        delay: (index % 4) * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -6, transition: { duration: 0.22, ease: "easeOut" } }}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white p-7 shadow-[0_2px_16px_rgba(11,31,58,0.05)] transition-shadow duration-300 ${a.glow}`}
    >
      {/* Expanding accent bar */}
      <div
        className={`mb-5 h-0.5 w-8 rounded-full bg-linear-to-r ${a.bar} transition-all duration-300 group-hover:w-16`}
      />

      {/* Icon */}
      <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${a.iconBg}`}>
        <ProgramIcon id={program.id} className={`h-5 w-5 ${a.iconColor}`} />
      </div>

      {/* Title + age badge */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-bold leading-snug text-[#0F172A]">
          {program.title}
        </h3>
        <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.iconBg} ${a.iconColor}`}>
          {program.ages}
        </span>
      </div>

      {/* Description */}
      <p className="mb-5 text-[13px] leading-relaxed text-[#334155]">
        {program.description}
      </p>

      {/* Tool chips */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {program.tools.map((tool) => (
          <span
            key={tool}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${a.chipBg} ${a.chipText}`}
          >
            {tool}
          </span>
        ))}
      </div>

      {/* Mini project examples */}
      <div className="mt-auto border-t border-[#E2E8F0] pt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8]">
          Projects
        </p>
        <ul className="space-y-1.5">
          {program.projects.map((proj) => (
            <li key={proj} className="flex items-center gap-2 text-[12px] text-[#334155]">
              <span className={`h-1 w-1 shrink-0 rounded-full ${a.dot}`} />
              {proj}
            </li>
          ))}
        </ul>
      </div>

      {/* Hover gradient wash */}
      <div
        className={`pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-br ${a.wash} to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-[0.035]`}
      />
    </motion.article>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function ProgramsSection() {
  return (
    <section
      id="programs"
      className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-32"
    >
      {/* Section header */}
      <SectionTitle
        eyebrow="Programs"
        heading={<>Future-Ready <span className="text-[#FF8A1F]">Learning Paths</span></>}
        body="Build real-world skills through AI, robotics, programming, game development, and innovation-focused projects."
      />

      {/* Cards grid — 1 col mobile / 2 col tablet / 4 col desktop */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 md:mt-16 md:gap-5 lg:grid-cols-4">
        {PROGRAMS.map((program, i) => (
          <ProgramCard key={program.id} program={program} index={i} />
        ))}
      </div>
    </section>
  );
}
