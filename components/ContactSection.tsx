"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ContactSection() {
  const { t } = useLanguage();

  return (
    <section id="contact" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-24">

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl bg-[#0B2341] px-8 py-14 text-center shadow-2xl md:px-16 md:py-20"
      >
        {/* Ambient glow — brand orange */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FF8A1F]/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-48 w-48 translate-x-1/4 translate-y-1/4 rounded-full bg-[#FF8A1F]/8 blur-3xl" />

        <h2 className="relative text-3xl font-bold text-white md:text-4xl">
          Ready to Start Your{" "}
          <span className="text-[#FF8A1F]">Tech Journey?</span>
        </h2>

        <p className="relative mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/60">
          Book a free trial session and discover what Robocode can unlock for your child.
        </p>

        <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {/* Primary CTA — orange */}
          <Link
            href="/book-session"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF8A1F] px-8 py-3.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(255,138,31,0.36)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_28px_rgba(255,138,31,0.46)]"
          >
            {t("hero.bookSession")}
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>

          {/* Secondary CTA — white outline */}
          <a
            href="https://wa.me/201234567890"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/8 px-8 py-3.5 text-sm font-bold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/15"
          >
            WhatsApp Us
          </a>
        </div>
      </motion.div>
    </section>
  );
}
