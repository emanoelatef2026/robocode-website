"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 18 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export default function Hero() {
  const { t } = useLanguage();
  const [heroImageUrl, setHeroImageUrl] = useState<string>("/hero-kids.png");

  useEffect(() => {
    fetch("/api/site-media?key=hero_image")
      .then((r) => r.json())
      .then((d: { image_url?: string } | null) => {
        if (d?.image_url) setHeroImageUrl(d.image_url);
      })
      .catch(() => {});
  }, []);

  const CTA_BUTTONS = (
    <>
      <Link
        href="/book-session"
        className="rounded-full bg-[#38BDF8] px-8 py-4 text-center text-sm font-bold text-white shadow-[0_4px_24px_rgba(56,189,248,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_32px_rgba(56,189,248,0.5)]"
      >
        {t("hero.bookSession")}
      </Link>

      <a
        href="#programs"
        className="rounded-full border-2 border-[#E2E8F0] bg-white px-8 py-4 text-center text-sm font-bold text-[#0B1F3A] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#38BDF8] hover:text-[#38BDF8] hover:shadow-[0_4px_16px_rgba(56,189,248,0.15)]"
      >
        {t("hero.explorePrograms")}
      </a>
    </>
  );

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
            {t("hero.eyebrow")}
          </p>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-[2.4rem] font-extrabold leading-[1.08] tracking-tight text-[#0F172A] sm:text-5xl lg:text-start lg:text-[4rem]"
        >
          {t("hero.heading1")}
          <span className="mt-3 block text-[#FF8A1F]">
            {t("hero.heading2")}
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          {...fadeUp(0.42)}
          className="mt-6 max-w-lg text-center text-sm font-medium tracking-[0.14em] text-[#64748B] sm:tracking-[0.18em] lg:text-start"
        >
          {t("hero.subtext")}
        </motion.p>

        {/* CTAs — desktop only */}
        <motion.div
          {...fadeUp(0.56)}
          className="mt-10 hidden w-full gap-4 lg:flex lg:justify-start"
        >
          {CTA_BUTTONS}
        </motion.div>

      </div>

      {/* RIGHT — hero image */}
      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="flex shrink-0 items-center justify-center"
      >
        <Image
          src={heroImageUrl}
          alt="Robocode School Students"
          width={700}
          height={700}
          priority
          className="h-auto w-full max-w-xs sm:max-w-sm md:max-w-md lg:w-135 lg:max-w-none xl:w-155"
        />
      </motion.div>

      {/* CTAs — mobile only, after sphere in flex-col */}
      <motion.div
        {...fadeUp(0.56)}
        className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:hidden"
      >
        {CTA_BUTTONS}
      </motion.div>

    </motion.section>
  );
}
