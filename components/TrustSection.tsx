"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import styles from "./public-site/HomeIntro.module.css";

// Existing published figures: retained, not independently verified by this redesign.
const STATS = [
  { value: "6+", labelKey: "trust.yearsLabel", icon: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" },
  { value: "8000+", labelKey: "trust.studentsLabel", icon: "M2 9l10-5 10 5-10 5L2 9M6 11v6c3 3 9 3 12 0v-6M22 9v7" },
  { value: "16000+", labelKey: "trust.parentsLabel", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0" },
  { value: "4.9", suffix: "/5", labelKey: "trust.ratingLabel", icon: "M12 3l2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2L3.2 9.6l6.2-.9L12 3z" },
] as const;

export default function TrustSection() {
  const { t } = useLanguage();

  return (
    <div className={styles.trust}>
      <dl className={styles.stats}>
        {STATS.map((stat) => (
          <div key={stat.labelKey} className={styles.stat}>
            <dt className={styles.statLabel}>{t(stat.labelKey)}</dt>
            <dd className={styles.statValue}>
              <svg className={styles.statIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d={stat.icon} />
              </svg>
              <bdi dir="ltr">{stat.value}{"suffix" in stat ? <span className={styles.suffix}>{stat.suffix}</span> : null}</bdi>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
