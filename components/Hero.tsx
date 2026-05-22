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
      className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center gap-10 px-6 pb-16 pt-28 md:pb-24 md:pt-36 lg:flex-row lg:items-center lg:justify-between lg:gap-20 lg:pb-28 lg:pt-44"
    >

      {/* LEFT — text content */}
      <div className="flex max-w-2xl flex-col items-center lg:items-start">

        {/* Eyebrow */}
        <motion.p
          {...fadeUp(0.15)}
          className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-[#19C6F4]"
        >
          The Future of Education
        </motion.p>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-[2.35rem] font-extrabold leading-[1.1] tracking-tight text-[#0B132B] sm:text-5xl lg:text-left lg:text-7xl"
        >
          We Don&apos;t Teach Kids To Use Technology

          <span className="mt-2 block text-[#19C6F4] sm:mt-3">
            We Teach Them To Build It
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          {...fadeUp(0.45)}
          className="mt-6 max-w-lg text-center text-xs font-medium tracking-[0.14em] text-slate-500 sm:tracking-[0.18em] lg:text-left lg:text-base"
        >
          AI • Robotics • Game Development • Programming • Future Skills
        </motion.p>

        {/* CTAs — stack full-width on mobile, inline on sm+ */}
        <motion.div
          {...fadeUp(0.6)}
          className="mt-9 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4 lg:justify-start"
        >
          <Link
            href="/book-session"
            className="rounded-full bg-[#19C6F4] px-8 py-4 text-center text-sm font-semibold text-white shadow-[0_0_24px_rgba(25,198,244,0.38)] transition duration-300 hover:scale-105 hover:shadow-[0_0_34px_rgba(25,198,244,0.55)]"
          >
            Book Free Session
          </Link>

          <a
            href="#programs"
            className="rounded-full border border-[#0B132B]/25 px-8 py-4 text-center text-sm font-semibold text-[#0B132B] transition duration-300 hover:border-[#F97316]/60 hover:text-[#F97316]"
          >
            Explore Programs
          </a>
        </motion.div>

      </div>

      {/* RIGHT — animated logo sphere */}
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex shrink-0 items-center justify-center"
      >
        {/* Circle: 240px mobile → 320px md → 360px lg */}
        <div className="relative flex h-60 w-60 items-center justify-center rounded-full bg-linear-to-br from-cyan-400 to-blue-500 shadow-[0_0_40px_rgba(34,211,238,0.22)] md:h-80 md:w-80 lg:h-90 lg:w-90 lg:shadow-[0_0_64px_rgba(34,211,238,0.3)]">

          <Image
            src="/logo.png"
            alt="Robocode"
            width={220}
            height={220}
            className="relative z-10 h-auto w-28 md:w-44 lg:w-[220px]"
          />

          {/* Floating Card 1 — AI Projects */}
          <div className="absolute -left-3 top-8 overflow-hidden rounded-xl border border-white/40 bg-white/75 px-4 py-3 shadow-xl backdrop-blur-xl md:-left-7.5 md:top-10 md:rounded-2xl md:px-6 md:py-4">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-[#F97316]/60 to-transparent" />
            <p className="text-xs font-semibold text-slate-500 md:text-sm">AI Projects</p>
            <h3 className="mt-0.5 text-lg font-bold text-[#0B132B] md:mt-1 md:text-2xl">150+</h3>
          </div>

          {/* Floating Card 2 — Students */}
          <div className="absolute -right-3 bottom-8 rounded-xl border border-white/40 bg-white/75 px-4 py-3 shadow-xl backdrop-blur-xl md:-right-7.5 md:bottom-10 md:rounded-2xl md:px-6 md:py-4">
            <p className="text-xs font-semibold text-slate-500 md:text-sm">Students</p>
            <h3 className="mt-0.5 text-lg font-bold text-[#0B132B] md:mt-1 md:text-2xl">3000+</h3>
          </div>

        </div>
      </motion.div>

    </motion.section>
  );
}
