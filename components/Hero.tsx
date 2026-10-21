"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { ButtonLink } from "./ui/Button";

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
      <ButtonLink
        href="/book-session"
      >
        {t("hero.bookSession")}
      </ButtonLink>

      {/* Secondary CTA — navy outline */}
      <ButtonLink
        href="#programs"
        variant="secondary"
      >
        {t("hero.explorePrograms")}
      </ButtonLink>
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
          className="text-center text-3xl font-extrabold leading-[1.12] tracking-tight text-[var(--navy)] sm:text-5xl lg:text-start lg:text-6xl"
        >
          {t("hero.heading1")}
          <span className="mt-2 block text-[var(--orange-strong)]">
            {t("hero.heading2")}
          </span>
        </motion.h1>

        {/* Subtext — brand body gray */}
        <motion.p
          {...fadeUp(0.3)}
          className="mt-5 max-w-md text-center text-base leading-relaxed text-[var(--text-3)] lg:text-start"
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
