"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] as const },
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
      {/* Primary CTA — orange */}
      <Link
        href="/book-session"
        className="rounded-full bg-[#FF8A1F] px-8 py-4 text-center text-sm font-bold text-white shadow-[0_4px_20px_rgba(255,138,31,0.36)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_28px_rgba(255,138,31,0.46)]"
      >
        {t("hero.bookSession")}
      </Link>

      {/* Secondary CTA — navy outline */}
      <a
        href="#programs"
        className="rounded-full border-2 border-[#0B2341]/20 bg-white px-8 py-4 text-center text-sm font-bold text-[#0B2341] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#0B2341]/40 hover:shadow-[0_4px_16px_rgba(11,35,65,0.10)]"
      >
        {t("hero.explorePrograms")}
      </a>
    </>
  );

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-center gap-8 px-6 pb-12 pt-24 md:gap-12 md:pb-16 md:pt-32 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:pb-20 lg:pt-36"
    >

      {/* LEFT — text content */}
      <div className="flex max-w-xl flex-col items-center lg:items-start">

        {/* H1 — brand navy, strong scale */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-3xl font-extrabold leading-[1.12] tracking-tight text-[#0B2341] sm:text-5xl lg:text-start lg:text-6xl"
        >
          {t("hero.heading1")}
          <span className="mt-2 block text-[#FF8A1F]">
            {t("hero.heading2")}
          </span>
        </motion.h1>

        {/* Subtext — brand body gray */}
        <motion.p
          {...fadeUp(0.3)}
          className="mt-5 max-w-md text-center text-base leading-relaxed text-[#64748B] lg:text-start"
        >
          {t("hero.subtext")}
        </motion.p>

        {/* CTAs — desktop */}
        <motion.div
          {...fadeUp(0.44)}
          className="mt-8 hidden w-full gap-4 lg:flex lg:justify-start"
        >
          {CTA_BUTTONS}
        </motion.div>

      </div>

      {/* RIGHT — hero image */}
      <div className="flex shrink-0 items-center justify-center">
        <Image
          src={heroImageUrl}
          alt="Robocode School Students"
          width={640}
          height={640}
          priority
          className="h-auto w-full max-w-72 sm:max-w-sm md:max-w-md lg:w-130 lg:max-w-none xl:w-145"
        />
      </div>

      {/* CTAs — mobile */}
      <motion.div
        {...fadeUp(0.44)}
        className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center lg:hidden"
      >
        {CTA_BUTTONS}
      </motion.div>

    </motion.section>
  );
}
