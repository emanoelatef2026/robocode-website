"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import SectionTitle from "./ui/SectionTitle";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stage {
  id:           string;
  title:        string;
  age_range:    string;
  description:  string;
  image_url:    string;
  skills:       string[];
  technologies: string[];
  outcomes:     string[];
  active:       boolean;
  sort_order:   number;
}

// ── Static fallback (shown instantly, replaced by real data when available) ───

const FALLBACK: Stage[] = [
  {
    id: "explorer",
    title: "Explorer",
    age_range: "Ages 6–8",
    description:
      "Students begin their tech journey through hands-on logic building, creative problem solving, and visual programming — building confidence and curiosity from day one.",
    image_url: "",
    skills:       ["Logical Thinking", "Creative Problem Solving", "Teamwork", "Digital Literacy"],
    technologies: ["Scratch", "LEGO Mindstorms", "ScratchJr", "Tinkercad"],
    outcomes: [
      "Build and animate their first game",
      "Program a LEGO robot to complete a challenge",
      "Design and present a creative digital project",
    ],
    active: true,
    sort_order: 0,
  },
  {
    id: "creator",
    title: "Creator",
    age_range: "Ages 9–11",
    description:
      "Students dive into game development, Roblox, Minecraft modding, and digital creation — turning imagination into interactive experiences through real scripting and design.",
    image_url: "",
    skills:       ["Game Design", "Digital Creativity", "Basic Scripting", "Iterative Design"],
    technologies: ["Roblox Studio", "Lua", "Minecraft", "Scratch 3.0"],
    outcomes: [
      "Publish a fully playable Roblox game",
      "Build a custom Minecraft adventure map",
      "Script a complete mini-game from scratch",
    ],
    active: true,
    sort_order: 1,
  },
  {
    id: "builder",
    title: "Builder",
    age_range: "Ages 12–14",
    description:
      "Students develop serious engineering skills in Python, web development, and hardware — building real apps, deploying live websites, and programming autonomous robots.",
    image_url: "",
    skills:       ["Python Programming", "Web Development", "Hardware Engineering", "Algorithmic Thinking"],
    technologies: ["Python", "HTML/CSS/JS", "Arduino", "React Basics"],
    outcomes: [
      "Deploy a live website with real users",
      "Build an Arduino-powered autonomous robot",
      "Create a Python tool that solves a real problem",
    ],
    active: true,
    sort_order: 2,
  },
  {
    id: "ai-engineer",
    title: "AI Engineer",
    age_range: "Ages 15–18",
    description:
      "Elite students build production-grade AI systems, automation pipelines, and startup prototypes — working with the same tools and methodologies used by industry professionals.",
    image_url: "",
    skills:       ["AI & Machine Learning", "Startup Thinking", "System Design", "Technical Leadership"],
    technologies: ["Python", "OpenAI API", "Make.com", "React", "Supabase"],
    outcomes: [
      "Train and deploy a custom AI model",
      "Launch a working startup prototype",
      "Compete and present at an international tech event",
    ],
    active: true,
    sort_order: 3,
  },
];

// ── Stage icons ───────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ReactNode> = {
  explorer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" />
    </svg>
  ),
  creator: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <path d="M17 5H7a4 4 0 0 0-4 4v4a4 4 0 0 0 4 4h1l2 2h4l2-2h1a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4z" />
      <path d="M6 11h4M8 9v4" />
      <circle cx="16" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  builder: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  "ai-engineer": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M20 9h2M2 15h2M20 15h2" />
    </svg>
  ),
};

function stageIcon(id: string) {
  const key = id.toLowerCase().replace(/\s+/g, "-");
  return ICONS[key] ?? ICONS["explorer"];
}

// ── Placeholder (no image uploaded yet) ──────────────────────────────────────

function StagePlaceholder({ stage }: { stage: Stage }) {
  return (
    <div className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-2xl bg-[#0B1F3A] lg:min-h-80">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF8A1F]/8 blur-3xl" />
      <div className="relative z-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#FF8A1F]">
          {stageIcon(stage.id)}
        </div>
        <p className="text-lg font-bold text-white">{stage.title}</p>
        <p className="mt-1 text-sm text-white/40">{stage.age_range}</p>
        <div className="mx-auto mt-4 h-px w-10 bg-[#FF8A1F]/30" />
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function LearningJourneySection() {
  const [stages,    setStages]    = useState<Stage[]>(FALLBACK);
  const [activeIdx, setActiveIdx] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/learning-journey")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d) && d.length > 0) setStages(d); })
      .catch(() => {});
  }, []);

  const active = stages[Math.min(activeIdx, stages.length - 1)];

  const handleTabClick = (i: number) => {
    setActiveIdx(i);
    const tabs = tabsRef.current?.querySelectorAll<HTMLElement>("[data-tab]");
    tabs?.[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  if (!active) return null;

  return (
    <section id="learning-journey" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-32">

      <SectionTitle
        eyebrow="Learning Journey"
        heading={<>Your Child&apos;s <span className="text-[#FF8A1F]">Tech Roadmap</span></>}
        body="A structured, age-based progression from curious beginner to confident builder — every step designed to build real, lasting skills."
      />

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="relative mt-12 md:mt-16">
        <div
          ref={tabsRef}
          className="flex overflow-x-auto border-b border-[#E2E8F0]"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {stages.map((stage, i) => (
            <button
              key={stage.id}
              data-tab
              onClick={() => handleTabClick(i)}
              className={[
                "relative shrink-0 px-5 pb-4 pt-1 text-left transition-colors duration-200 focus:outline-none md:px-8",
                activeIdx === i ? "text-[#0F172A]" : "text-[#94A3B8] hover:text-[#64748B]",
              ].join(" ")}
            >
              <span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-[#FF8A1F]">
                {stage.age_range}
              </span>
              <span className="mt-1 block whitespace-nowrap text-[15px] font-bold md:text-base">
                {stage.title}
              </span>

              {activeIdx === i && (
                <motion.div
                  layoutId="tabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#FF8A1F]"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIdx}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 grid items-start gap-10 lg:grid-cols-2 lg:gap-16"
          >

            {/* Left — text content */}
            <div className="order-2 lg:order-1">

              <p className="text-base leading-relaxed text-[#334155] md:text-lg">
                {active.description}
              </p>

              {/* Skills */}
              {active.skills.length > 0 && (
                <div className="mt-8">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#94A3B8]">
                    Skills Developed
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {active.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#334155] shadow-[0_1px_4px_rgba(11,31,58,0.05)]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Technologies */}
              {active.technologies.length > 0 && (
                <div className="mt-6">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-[#94A3B8]">
                    Technologies
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {active.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-lg bg-[#FF8A1F]/10 px-3 py-1.5 text-[12px] font-bold text-[#FF8A1F]"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Outcomes */}
              {active.outcomes.length > 0 && (
                <div className="mt-8">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-[#94A3B8]">
                    What They&apos;ll Build
                  </p>
                  <ul className="space-y-3">
                    {active.outcomes.map((outcome) => (
                      <li
                        key={outcome}
                        className="flex items-start gap-3 text-[13px] leading-relaxed text-[#334155] md:text-sm"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF8A1F]/12">
                          <svg viewBox="0 0 12 12" className="h-3 w-3 text-[#FF8A1F]">
                            <path
                              d="M2 6l2.5 2.5L10 3.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            />
                          </svg>
                        </span>
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right — image */}
            <div className="order-1 lg:order-2">
              {active.image_url ? (
                <div className="overflow-hidden rounded-2xl shadow-[0_8px_40px_rgba(11,31,58,0.12)]">
                  <Image
                    src={active.image_url}
                    alt={active.title}
                    width={800}
                    height={450}
                    className="h-auto w-full rounded-2xl object-cover"
                    style={{ aspectRatio: "16/9" }}
                  />
                </div>
              ) : (
                <StagePlaceholder stage={active} />
              )}
            </div>

          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
