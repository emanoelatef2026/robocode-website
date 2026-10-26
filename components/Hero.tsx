"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { ButtonLink } from "./ui/Button";
import styles from "./public-site/HomeIntro.module.css";

const DEFAULT_IMAGE = "/hero-kids.png";

export default function Hero() {
  const { t } = useLanguage();
  const [heroImageUrl, setHeroImageUrl] = useState(DEFAULT_IMAGE);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/site-media?key=hero_image", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { image_url?: string } | null) => {
        if (!controller.signal.aborted && data?.image_url) setHeroImageUrl(data.image_url);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <section className={styles.hero} aria-labelledby="home-hero-title">
      <div className={styles.content}>
        <h1 id="home-hero-title" className={styles.heading}>
          {t("hero.heading1")}
          <span className={styles.accent}>{t("hero.heading2")}</span>
        </h1>
        <p className={styles.description}>{t("hero.subtext")}</p>
        <div className={styles.actions}>
          <ButtonLink href="/book-session" className={styles.primaryAction}>{t("hero.bookSession")}</ButtonLink>
          <Link href="#programs" className={styles.secondaryAction}>{t("hero.explorePrograms")} <span aria-hidden="true">↓</span></Link>
        </div>
      </div>
      <div className={styles.visual}>
        <Image
          src={heroImageUrl}
          alt={t("hero.imageAlt")}
          width={640}
          height={640}
          priority
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 320px, 280px"
          className={styles.image}
          onError={() => { if (heroImageUrl !== DEFAULT_IMAGE) setHeroImageUrl(DEFAULT_IMAGE); }}
        />
      </div>
    </section>
  );
}
