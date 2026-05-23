"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 18 },
  animate:    { opacity: 1, y: 0 },
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
        <motion.div {...fadeUp(0.12)} className="mb-5 flex items-center gap-2">
          <span className="h-px w-8 bg-[#FF8A1F]" />
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#FF8A1F]">
            The Future of Education
          </p>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-[2.4rem] font-extrabold leading-[1.08] tracking-tight text-[#0F172A] sm:text-5xl lg:text-left lg:text-[4rem]"
        >
          We Don&apos;t Teach Kids To Use Technology

          <span className="mt-3 block text-[#FF8A1F]">
            We Teach Them To Build It
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          {...fadeUp(0.42)}
          className="mt-6 max-w-lg text-center text-sm font-medium tracking-[0.14em] text-[#64748B] sm:tracking-[0.18em] lg:text-left"
        >
          AI · Robotics · Game Development · Programming · Future Skills
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeUp(0.56)}
          className="mt-10 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4 lg:justify-start"
        >
          <Link
            href="/book-session"
            className="rounded-full bg-[#FF8A1F] px-8 py-4 text-center text-sm font-bold text-white shadow-[0_4px_24px_rgba(255,138,31,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_32px_rgba(255,138,31,0.5)]"
          >
            Book Free Session
          </Link>

          <a
            href="#programs"
            className="rounded-full border-2 border-[#E2E8F0] bg-white px-8 py-4 text-center text-sm font-bold text-[#0B1F3A] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#FF8A1F] hover:text-[#FF8A1F] hover:shadow-[0_4px_16px_rgba(255,138,31,0.15)]"
          >
            Explore Programs
          </a>
        </motion.div>

      </div>

      {/* RIGHT — animated sphere */}
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex shrink-0 items-center justify-center"
      >
        {/* Circle */}
        <div className="relative flex h-60 w-60 items-center justify-center rounded-full bg-gradient-to-br from-[#0B1F3A] to-[#163560] shadow-[0_0_60px_rgba(11,31,58,0.3)] md:h-80 md:w-80 lg:h-[360px] lg:w-[360px]">

          {/* Subtle ring */}
          <div className="absolute inset-0 rounded-full ring-1 ring-white/10" />

          <Image
            src="/logo.png"
            alt="Robocode"
            width={220}
            height={220}
            className="relative z-10 h-auto w-28 brightness-0 invert md:w-44 lg:w-[200px]"
          />

          {/* Floating Card 1 — AI Projects */}
          <div className="absolute -left-3 top-8 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(11,31,58,0.12)] md:-left-8 md:top-10 md:rounded-2xl md:px-6 md:py-4">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#FF8A1F] to-[#FFB15A]" />
            <p className="text-xs font-semibold text-[#64748B] md:text-sm">AI Projects</p>
            <h3 className="mt-0.5 text-lg font-extrabold text-[#0B1F3A] md:mt-1 md:text-2xl">150+</h3>
          </div>

          {/* Floating Card 2 — Students */}
          <div className="absolute -right-3 bottom-8 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(11,31,58,0.12)] md:-right-8 md:bottom-10 md:rounded-2xl md:px-6 md:py-4">
            <p className="text-xs font-semibold text-[#64748B] md:text-sm">Students</p>
            <h3 className="mt-0.5 text-lg font-extrabold text-[#0B1F3A] md:mt-1 md:text-2xl">8000+</h3>
          </div>

        </div>
      </motion.div>

    </motion.section>
  );
}
