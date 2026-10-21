"use client";

import { motion } from "framer-motion";
import PublicSectionTitle from "./public-site/PublicSectionTitle";

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
  orange: "from-[var(--orange-strong)] to-[#FFB15A]",
  navy:   "from-[var(--navy)] to-[var(--navy-light)]",
};

const HOVER_SHADOW: Record<"orange" | "navy", string> = {
  orange: "hover:shadow-[var(--shadow-card)]",
  navy:   "hover:shadow-[var(--shadow-card)]",
};

export default function CompetitionsSection() {
  return (
    <section
      id="competitions"
      className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-24"
    >
        <PublicSectionTitle section="competitions" />

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
              className={`group relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] transition-shadow duration-300 md:rounded-[var(--radius-xl)] md:p-8 ${HOVER_SHADOW[accent]}`}
            >
              {/* Accent bar — expands on hover */}
              <div
                className={`mb-6 h-0.5 w-10 rounded-full bg-linear-to-r ${BAR[accent]} transition-all duration-300 group-hover:w-20`}
              />

              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">
                {tag}
              </p>

              <h3 className="text-lg font-bold leading-snug text-[var(--text)]">
                {title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
                {description}
              </p>
            </motion.div>
          ))}
        </div>
    </section>
  );
}
