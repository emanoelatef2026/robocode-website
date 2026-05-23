"use client";

import { motion } from "framer-motion";
import SectionTitle from "./ui/SectionTitle";

const STAGES = [
  {
    age:   "Ages 6–8",
    title: "Explorer",
    desc:  "Logic building, Scratch programming, LEGO robotics, creativity, and problem solving.",
    color: "#0B1F3A",
    side:  "left" as const,
  },
  {
    age:   "Ages 9–11",
    title: "Creator",
    desc:  "Game development, Roblox, Minecraft, animation, robotics, and digital creativity.",
    color: "#FF8A1F",
    side:  "right" as const,
  },
  {
    age:   "Ages 12–14",
    title: "Developer",
    desc:  "Python, web development, Arduino, AI foundations, and real-world coding projects.",
    color: "#0B1F3A",
    side:  "left" as const,
  },
  {
    age:   "Ages 15–17",
    title: "Innovator",
    desc:  "AI automation, startups, advanced programming, real applications, and innovation projects.",
    color: "#FF8A1F",
    side:  "right" as const,
  },
];

export default function LearningJourneySection() {
  return (
    <section id="learning-journey" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-32">

      <SectionTitle
        eyebrow="Learning Journey"
        heading={<>A Complete <span className="text-[#FF8A1F]">Future Tech</span> Roadmap</>}
        body="Students progress through a structured learning journey based on age, skills, creativity, and innovation."
      />

      {/* Timeline */}
      <div className="relative mt-14 md:mt-24">

        {/* Center line */}
        <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 rounded-full bg-[#E2E8F0] md:block" />

        <div className="space-y-8 md:space-y-16">
          {STAGES.map((stage, i) => (
            <motion.div
              key={stage.title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={`relative grid items-center gap-5 md:grid-cols-2 md:gap-10 ${stage.side === "right" ? "md:[&>*:first-child]:order-last" : ""}`}
            >
              {stage.side === "left" ? (
                <>
                  <div
                    className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_16px_rgba(11,31,58,0.05)] md:rounded-3xl md:p-10"
                    style={{ borderLeft: `2px solid ${stage.color}20` }}
                  >
                    <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: stage.color }}>
                      {stage.age}
                    </p>
                    <h3 className="mt-3 text-2xl font-bold md:mt-4 md:text-3xl">{stage.title}</h3>
                    <p className="mt-3 text-base text-[#334155] md:mt-4 md:text-lg">{stage.desc}</p>
                  </div>
                  <div className="hidden md:flex justify-center">
                    <div
                      className="h-8 w-8 rounded-full"
                      style={{ background: stage.color, boxShadow: `0 0 28px ${stage.color}88` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="hidden md:flex justify-center">
                    <div
                      className="h-8 w-8 rounded-full"
                      style={{ background: stage.color, boxShadow: `0 0 28px ${stage.color}70` }}
                    />
                  </div>
                  <div
                    className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_16px_rgba(11,31,58,0.05)] md:rounded-3xl md:p-10"
                    style={{ borderLeft: `2px solid ${stage.color}20` }}
                  >
                    <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: stage.color }}>
                      {stage.age}
                    </p>
                    <h3 className="mt-3 text-2xl font-bold md:mt-4 md:text-3xl">{stage.title}</h3>
                    <p className="mt-3 text-base text-[#334155] md:mt-4 md:text-lg">{stage.desc}</p>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
