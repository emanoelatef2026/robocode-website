"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import SectionTitle from "./ui/SectionTitle";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stage {
  id:          string;
  title:       string;
  age_range:   string;
  description: string;
  image_url:   string;
  active:      boolean;
  sort_order:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// "Ages 6–8" → "6–8" (handles any prefix format)
const ageShort = (r: string) => r.replace(/^Ages?\s*/i, "");

// ── Static fallback ───────────────────────────────────────────────────────────

const FALLBACK: Stage[] = [
  {
    id:          "explorer",
    title:       "Explorer",
    age_range:   "Ages 6–8",
    description: "Students begin their tech journey through hands-on logic building, creative problem solving, and visual programming — building confidence and curiosity from day one.",
    image_url:   "",
    active:      true,
    sort_order:  0,
  },
  {
    id:          "creator",
    title:       "Creator",
    age_range:   "Ages 9–11",
    description: "Students dive into game development, Roblox, Minecraft modding, and digital creation — turning imagination into interactive experiences through real scripting and design.",
    image_url:   "",
    active:      true,
    sort_order:  1,
  },
  {
    id:          "builder",
    title:       "Builder",
    age_range:   "Ages 12–14",
    description: "Students develop serious engineering skills in Python, web development, and hardware — building real apps, deploying live websites, and programming autonomous robots.",
    image_url:   "",
    active:      true,
    sort_order:  2,
  },
  {
    id:          "ai-engineer",
    title:       "AI Engineer",
    age_range:   "Ages 15–18",
    description: "Elite students build production-grade AI systems, automation pipelines, and startup prototypes — using the same tools and methodologies as industry professionals.",
    image_url:   "",
    active:      true,
    sort_order:  3,
  },
];

// ── Placeholder (no image uploaded) ──────────────────────────────────────────

function StagePlaceholder({ title }: { title: string }) {
  return (
    <div className="relative w-full bg-[#0B1F3A]" style={{ aspectRatio: "16/9" }}>
      {/* Subtle grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-size-[48px_48px]" />
      {/* Cyan ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#38BDF8]/6 blur-3xl" />
      {/* Ghost text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="select-none text-5xl font-black text-white/[0.07] md:text-8xl">{title}</p>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function LearningJourneySection() {
  const [stages,    setStages]    = useState<Stage[]>(FALLBACK);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    fetch("/api/learning-journey")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d) && d.length > 0) setStages(d); })
      .catch(() => {});
  }, []);

  const active = stages[Math.min(activeIdx, stages.length - 1)];
  if (!active) return null;

  return (
    <section id="learning-journey" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-24">

      <SectionTitle
        eyebrow="Learning Journey"
        heading={<>Your Child&apos;s <span className="text-[#FF8A1F]">Tech Roadmap</span></>}
        body="A structured, age-based progression — from curious beginner to confident builder."
      />

      <div className="mt-10 md:mt-14">

        {/* ── Tabs: flex single row, equal width, no overflow ────────────────── */}
        <div className="flex gap-2 sm:gap-3">
          {stages.map((stage, i) => {
            const isActive = activeIdx === i;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveIdx(i)}
                className={[
                  "relative min-w-0 flex-1 overflow-hidden rounded-xl border py-3 text-center transition-all duration-200 focus:outline-none sm:py-4",
                  isActive
                    ? "border-[#0B1F3A] bg-[#0B1F3A] shadow-[0_6px_24px_rgba(11,31,58,0.22),0_0_0_1px_rgba(56,189,248,0.14)]"
                    : "border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(11,31,58,0.04)] hover:-translate-y-px hover:border-[#CBD5E1] hover:shadow-[0_3px_12px_rgba(11,31,58,0.08)]",
                ].join(" ")}
              >
                {/* Orange top accent — active indicator */}
                {isActive && (
                  <span className="absolute inset-x-0 top-0 h-0.75 bg-[#FF8A1F]" />
                )}

                {/* Age number — primary label */}
                <p className={`text-sm font-extrabold leading-none sm:text-base ${isActive ? "text-white" : "text-[#0F172A]"}`}>
                  {ageShort(stage.age_range)}
                </p>

                {/* "ages" — secondary label, cyan when active */}
                <p className={`mt-1 text-[9px] font-bold uppercase tracking-widest ${isActive ? "text-[#38BDF8]" : "text-[#94A3B8]"}`}>
                  ages
                </p>
              </button>
            );
          })}
        </div>

        {/* ── Content: text → image ─────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-8"
          >
            {/* Stage copy — centered, above image */}
            <div className="mx-auto max-w-2xl text-center">
              {/* Age range — cyan accent */}
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#38BDF8]">
                {active.age_range}
              </p>

              {/* Stage title */}
              <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0F172A] md:text-3xl">
                {active.title}
              </h3>

              {/* Description */}
              <p className="mt-3 text-[15px] leading-relaxed text-[#64748B]">
                {active.description}
              </p>
            </div>

            {/* Hero image — centered, max-w-5xl, premium framing */}
            <div className="mx-auto mt-8 max-w-5xl">
              {active.image_url ? (
                <div className="overflow-hidden rounded-xl shadow-[0_4px_32px_rgba(11,31,58,0.10),0_0_0_1px_rgba(56,189,248,0.10)]">
                  <Image
                    src={active.image_url}
                    alt={active.title}
                    width={1600}
                    height={900}
                    className="h-auto w-full rounded-xl object-cover"
                    priority={activeIdx === 0}
                  />
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl shadow-[0_4px_32px_rgba(11,31,58,0.10),0_0_0_1px_rgba(56,189,248,0.10)]">
                  <StagePlaceholder title={active.title} />
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
}
