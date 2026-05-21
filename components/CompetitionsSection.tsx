"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

const COMPETITIONS = [
  {
    tag: "Engineering",
    title: "Robotics Competitions",
    description:
      "Build and program autonomous robots that navigate real-world arenas — developing mechanical precision, sensor logic, and decisive teamwork.",
    gradient: "from-[#19C6F4] to-blue-500",
  },
  {
    tag: "Intelligence",
    title: "AI Challenges",
    description:
      "Design intelligent systems that solve data-driven problems — from image recognition and prediction models to smart automation pipelines.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    tag: "Innovation",
    title: "Hackathons",
    description:
      "Sprint through 24-hour innovation challenges where students prototype, iterate, and pitch real solutions under real pressure.",
    gradient: "from-orange-400 to-rose-500",
  },
  {
    tag: "Creativity",
    title: "Innovation Contests",
    description:
      "Translate bold ideas into real inventions — evaluated by industry experts on impact, originality, and quality of execution.",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    tag: "Leadership",
    title: "Team Collaboration",
    description:
      "Work within structured cross-functional teams. Own roles, lead decisions, and deliver cohesive results under competition conditions.",
    gradient: "from-[#F97316] to-orange-400",
  },
  {
    tag: "Global",
    title: "International Preparation",
    description:
      "Train for world-class STEM competitions and represent Robocode on the international stage with confidence, skill, and precision.",
    gradient: "from-[#19C6F4] to-indigo-500",
  },
];

export default function CompetitionsSection() {
  return (
    <Reveal>
      <section
        id="competitions"
        className="relative z-10 mx-auto max-w-7xl px-6 pb-32"
      >
        {/* Section header */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#19C6F4]">
            Competitions
          </p>
          <h2 className="mt-4 text-4xl font-bold md:text-6xl">
            Compete. Innovate. Win.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-700">
            Robocode students compete on local, national, and international
            stages — turning classroom skills into championship results.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {COMPETITIONS.map(({ tag, title, description, gradient }, i) => (
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
              whileHover={{ y: -6, transition: { duration: 0.22, ease: "easeOut" } }}
              className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-8 shadow-lg backdrop-blur-xl"
            >
              {/* Accent bar — expands on hover */}
              <div
                className={`mb-6 h-0.75 w-10 rounded-full bg-linear-to-r ${gradient} transition-all duration-300 group-hover:w-20`}
              />

              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                {tag}
              </p>

              <h3 className="text-lg font-bold leading-snug text-[#0B132B]">
                {title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {description}
              </p>

              {/* Subtle gradient wash on hover */}
              <div
                className={`pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-br ${gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-[0.045]`}
              />
            </motion.div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
