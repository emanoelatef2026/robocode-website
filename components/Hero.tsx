"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export default function Hero() {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center gap-14 px-6 pb-24 pt-36 lg:flex-row lg:items-center lg:justify-between lg:gap-20 lg:pb-28 lg:pt-44"
    >

      {/* LEFT */}
      <div className="flex max-w-2xl flex-col items-center lg:items-start">

        {/* Eyebrow */}
        <motion.p
          {...fadeUp(0.15)}
          className="mb-6 text-xs font-semibold uppercase tracking-[0.3em] text-[#19C6F4]"
        >
          The Future of Education
        </motion.p>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-5xl font-extrabold leading-[1.08] tracking-tight text-[#0B132B] lg:text-left lg:text-7xl"
        >
          We Don&apos;t Teach Kids To Use Technology

          <span className="mt-3 block text-[#19C6F4]">
            We Teach Them To Build It
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          {...fadeUp(0.45)}
          className="mt-7 max-w-lg text-center text-sm font-medium tracking-[0.18em] text-slate-500 lg:text-left lg:text-base"
        >
          AI • Robotics • Game Development • Programming • Future Skills
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeUp(0.6)}
          className="mt-10 flex flex-wrap justify-center gap-4 lg:justify-start"
        >
          <Link
            href="/book-session"
            className="rounded-full bg-[#19C6F4] px-8 py-4 text-sm font-semibold text-white shadow-[0_0_24px_rgba(25,198,244,0.38)] transition duration-300 hover:scale-105 hover:shadow-[0_0_34px_rgba(25,198,244,0.55)]"
          >
            Book Free Session
          </Link>

          <a
            href="#programs"
            className="rounded-full border border-[#0B132B]/25 px-8 py-4 text-sm font-semibold text-[#0B132B] transition duration-300 hover:border-[#F97316]/60 hover:text-[#F97316]"
          >
            Explore Programs
          </a>
        </motion.div>

      </div>

      {/* RIGHT */}
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex shrink-0 items-center justify-center"
      >
        <div className="relative flex h-90 w-90 items-center justify-center rounded-full bg-linear-to-br from-cyan-400 to-blue-500 shadow-[0_0_64px_rgba(34,211,238,0.3)]">

          <Image
            src="/logo.png"
            alt="Robocode"
            width={220}
            height={220}
            className="relative z-10"
          />

          {/* Floating Card 1 */}
          <div className="absolute -left-7.5 top-10 overflow-hidden rounded-2xl border border-white/40 bg-white/70 px-6 py-4 shadow-xl backdrop-blur-xl">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-[#F97316]/60 to-transparent" />
            <p className="text-sm font-semibold text-slate-500">AI Projects</p>
            <h3 className="mt-1 text-2xl font-bold text-[#0B132B]">150+</h3>
          </div>

          {/* Floating Card 2 */}
          <div className="absolute bottom-10 -right-7.5 rounded-2xl border border-white/40 bg-white/70 px-6 py-4 shadow-xl backdrop-blur-xl">
            <p className="text-sm font-semibold text-slate-500">Students</p>
            <h3 className="mt-1 text-2xl font-bold text-[#0B132B]">3000+</h3>
          </div>

        </div>
      </motion.div>

    </motion.section>
  );
}
