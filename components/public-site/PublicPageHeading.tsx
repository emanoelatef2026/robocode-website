"use client";
import { useLanguage } from "@/contexts/LanguageContext";

const TITLES = {
  booking: { ar: "احجز تجربة أونلاين", en: "Book an Online Trial" },
  blog: { ar: "المدونة", en: "Blog" },
};

export default function PublicPageHeading({ kind }: { kind: keyof typeof TITLES }) {
  const { locale } = useLanguage();
  return <header data-site-page-header><h1>{TITLES[kind][locale]}</h1></header>;
}
