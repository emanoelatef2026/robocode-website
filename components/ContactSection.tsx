"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function ContactSection() {
  return (
    <section id="contact" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-32">

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-3xl bg-[#0B132B] px-8 py-16 text-center shadow-2xl md:px-16 md:py-24"
      >
        {/* Glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-[#19C6F4]/15 blur-3xl" />

        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#19C6F4]">
          Get In Touch
        </p>
        <h2 className="relative mt-4 text-3xl font-bold text-white md:text-5xl">
          Ready to Start Your{" "}
          <span className="bg-linear-to-r from-[#19C6F4] to-[#F97316] bg-clip-text text-transparent">
            Tech Journey?
          </span>
        </h2>
        <p className="relative mx-auto mt-5 max-w-xl text-base text-white/60 md:text-lg">
          Book a free trial session and see the magic of Robocode for yourself.
        </p>

        <div className="relative mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/book-session"
            className="inline-flex items-center gap-2 rounded-full bg-[#19C6F4] px-8 py-3.5 text-sm font-bold text-[#0B132B] shadow-lg transition hover:brightness-110"
          >
            Book Free Trial
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <a
            href="https://wa.me/201234567890"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/8 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-white/15"
          >
            WhatsApp Us
          </a>
        </div>
      </motion.div>
    </section>
  );
}
