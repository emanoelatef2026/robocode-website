"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import styles from "./PublicSectionTitle.module.css";

export const PUBLIC_HEADINGS = {
  programs: { ar: "المراحل التعليمية", en: "Learning Pathways" },
  pricing: { ar: "أسعار الأونلاين", en: "Online Prices" },
  why: { ar: "لماذا Robocode؟", en: "Why Robocode?" },
  projects: { ar: "مشروعات الطلاب", en: "Student Projects" },
  students: { ar: "طلابنا", en: "Our Students" },
  competitions: { ar: "المسابقات", en: "Competitions" },
  branches: { ar: "فروعنا", en: "Our Branches" },
  accreditations: { ar: "الاعتمادات", en: "Accreditations" },
  partners: { ar: "شركاؤنا", en: "Our Partners" },
  reviews: { ar: "آراء أولياء الأمور", en: "Parent Reviews" },
  faq: { ar: "الأسئلة الشائعة", en: "Frequently Asked Questions" },
  contact: { ar: "تواصل معنا", en: "Contact Us" },
} as const;

export default function PublicSectionTitle({ section, id, inverse = false }: {
  section: keyof typeof PUBLIC_HEADINGS;
  id?: string;
  inverse?: boolean;
}) {
  const { locale } = useLanguage();
  return <h2 id={id} className={`${styles.title}${inverse ? ` ${styles.inverse}` : ""}`}>{PUBLIC_HEADINGS[section][locale]}</h2>;
}
