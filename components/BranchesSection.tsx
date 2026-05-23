"use client";

import { motion } from "framer-motion";

const BRANCHES = [
  { city: "Cairo",       area: "Maadi",      flag: "🇪🇬" },
  { city: "Cairo",       area: "Heliopolis", flag: "🇪🇬" },
  { city: "Alexandria",  area: "Smouha",     flag: "🇪🇬" },
  { city: "Dubai",       area: "Coming Soon",flag: "🇦🇪" },
];

export default function BranchesSection() {
  return (
    <section id="branches" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-32">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#19C6F4]">Our Locations</p>
        <h2 className="mt-4 text-3xl font-bold text-[#0B132B] md:text-5xl lg:text-6xl">
          Robocode{" "}
          <span className="bg-linear-to-r from-[#19C6F4] to-[#F97316] bg-clip-text text-transparent">
            Branches
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 md:text-lg">
          Find your nearest Robocode hub and start your child&apos;s tech journey today.
        </p>
        <div className="mx-auto mt-6 h-px w-20 bg-linear-to-r from-[#19C6F4] to-[#F97316]" />
      </motion.div>

      {/* Cards */}
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 md:mt-20">
        {BRANCHES.map((branch, i) => (
          <motion.div
            key={`${branch.city}-${branch.area}`}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-xl md:rounded-3xl md:p-8"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-[#19C6F4] to-[#F97316] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="text-4xl">{branch.flag}</span>
            <h3 className="mt-4 text-xl font-bold text-[#0B132B]">{branch.city}</h3>
            <p className="mt-1 text-sm text-slate-500">{branch.area}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
