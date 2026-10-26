"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import Image from "next/image";
import PublicSectionTitle from "./public-site/PublicSectionTitle";
import styles from "./public-site/WhyBenefits.module.css";

const BENEFITS = [
  { key: "projects" },
  { key: "attention" },
  { key: "progress" },
  { key: "pathway" },
] as const;

// Curated bilingual benefits replace the legacy CMS tab/image presentation.
// Existing tab records and images are retained, not edited or deleted.
export default function WhySection() {
  const { t } = useLanguage();

  return (
    <section id="why" aria-labelledby="why-heading" className={styles.section}>
      <PublicSectionTitle section="why" id="why-heading" />
      <ul className={styles.benefits} role="list">
        {BENEFITS.map(({ key }) => (
          <li key={key} className={styles.benefit}>
            <Image src={`/images/why/${key}-v2-transparent.webp`} alt={t(`why.compact.${key}.imageAlt`)} width={512} height={512} sizes="(min-width: 1280px) 248px, (min-width: 1024px) 22vw, 80px" className={styles.picture} />
            <div className={styles.copy}>
              <h3 className={styles.title}>{t(`why.compact.${key}.title`)}</h3>
              <p className={styles.description}>{t(`why.compact.${key}.description`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
