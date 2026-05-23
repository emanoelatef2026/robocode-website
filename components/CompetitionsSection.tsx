"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";
import SectionTitle from "./ui/SectionTitle";

const COMPETITIONS = [
  {
    tag: "Engineering",
    title: "Robotics Competitions",
    description:
      "Build and program autonomous robots that navigate real-world arenas — developing mechanical precision, sensor logic, and decisive teamwork.",
    accent: "orange" as const,
  },
  {
    tag: "Intelligence",
    title: "AI Challenges",
    description:
      "Design intelligent systems that solve data-driven problems — from image recognition and prediction models to smart automation pipelines.",
    accent: "navy" as const,
  },
  {
    tag: "Innovation",
    title: "Hackathons",
    description:
      "Sprint through 24-hour innovation challenges where students prototype, iterate, and pitch real solutions under real pressure.",
    accent: "orange" as const,
  },
  {
    tag: "Creativity",
    title: "Innovation Contests",
    description:
      "Translate bold ideas into real inventions — evaluated by industry experts on impact, originality, and quality of execution.",
    accent: "navy" as const,
  },
  {
    tag: "Leadership",
    title: "Team Collaboration",
    description:
      "Work within structured cross-functional teams. Own roles, lead decisions, and deliver cohesive results under competition conditions.",
    accent: "orange" as const,
  },
  {
    tag: "Global",
    title: "International Preparation",
    description:
      "Train for world-class STEM competitions and represent Robocode on the international stage with confidence, skill, and precision.",
    accent: "navy" as const,
  },
];

const BAR: Record<"orange" | "navy", string> = {
  orange: "from-[#FF8A1F] to-[#FFB15A]",
  navy:   "from-[#0B1F3A] to-[#163560]",
};

const HOVER_SHADOW: Record<"orange" | "navy", string> = {
  orange: "hover:shadow-[0_12px_40px_rgba(255,138,31,0.14)]",
  navy:   "hover:shadow-[0_12px_40px_rgba(11,31,58,0.10)]",
};

export default function CompetitionsSection() {
  return (
    <Reveal>
      <section
        id="competitions"
        className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-32"
      >
        <SectionTitle
          eyebrow="Competitions"
          heading={<>Compete. <span className="text-[#FF8A1F]">Innovate.</span> Win.</>}
          body="Robocode students compete on local, national, and international stages — turning classroom skills into championship results."
        />

        {/* Cards */}
        <div className="mt-10 grid gap-4 md:mt-16 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {COMPETITIONS.map(({ tag, title, description, accent }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{
                duration: 0.55,
                delay: i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -4, transition: { duration: 0.22, ease: "easeOut" } }}
              className={`group relative overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_2px_16px_rgba(11,31,58,0.05)] transition-shadow duration-300 md:rounded-3xl md:p-8 ${HOVER_SHADOW[accent]}`}
            >
              {/* Accent bar — expands on hover */}
              <div
                className={`mb-6 h-0.5 w-10 rounded-full bg-linear-to-r ${BAR[accent]} transition-all duration-300 group-hover:w-20`}
              />

              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#94A3B8]">
                {tag}
              </p>

              <h3 className="text-lg font-bold leading-snug text-[#0F172A]">
                {title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-[#334155]">
                {description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
