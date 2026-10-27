"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import styles from "./public-site/PublicFooter.module.css";

const SOCIALS = [
  { label: "Facebook",  short: "Fb", href: "https://www.facebook.com/RobocodeSchool" },
  { label: "Instagram", short: "In", href: "https://www.instagram.com/robocode_school/" },
  { label: "LinkedIn",  short: "Li", href: "https://www.linkedin.com/company/robocode-school/?viewAsMember=true" },
  { label: "TikTok",    short: "Tk", href: "https://www.tiktok.com/@robocode_school" },
];

const LEGAL_LINKS = [
  { label: "Terms & Conditions", ar: "الشروط والأحكام", href: "/terms-and-conditions" },
  { label: "Refund Policy", ar: "سياسة الاسترداد", href: "/refund-policy" },
  { label: "Privacy Policy", ar: "سياسة الخصوصية", href: "/privacy-policy" },
];

export default function Footer() {
  const { t, locale } = useLanguage();
  const pathname = usePathname();

  const PROGRAM_LINKS = [
    { key: "footer.linkAi",       href: "/#programs" },
    { key: "footer.linkRobotics", href: "/#programs" },
    { key: "footer.linkGameDev",  href: "/#programs" },
    { key: "footer.linkWebDev",   href: "/#programs" },
  ];

  const COMPANY_LINKS = [
    { key: "footer.linkAbout",        href: "/#why"          },
    { key: "footer.linkBranches",     href: "/#branches"     },
    { key: "footer.linkContact",      href: "/#contact"      },
  ];

  // Scroll-to-section helper (same logic as Navbar)
  const handleFooterLink = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname !== "/" || !href.startsWith("/#")) return;
    e.preventDefault();
    const id = href.slice(2);
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>

        {/* Top grid */}
        <div className={styles.grid}>

          {/* Brand */}
          <div className={styles.brand}>
            <div className={styles.logoPlate}>
            <Image
              src="/logo.png"
              alt="Robocode Logo"
              width={112}
              height={112}
              sizes="(max-width: 639px) 68px, 96px"
              className={styles.logo}
            />
            </div>

            <p className={styles.tagline}>
              {t("footer.tagline")}
            </p>
            <p className={styles.mobileTagline}>{locale === "ar" ? "برمجة وذكاء اصطناعي للأعمار من 6 إلى 17 سنة." : "Coding and AI for ages 6–17."}</p>

            <div className={styles.socials}>
              {SOCIALS.map(({ label, short, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/25 text-xs font-semibold transition duration-200 hover:border-white"
                >
                  {short}
                </a>
              ))}
            </div>
          </div>

          {/* Programs */}
          <div className={styles.linkGroup}>
            <p data-site-footer-label>
              {t("footer.programsHeading")}
            </p>
            <ul className={styles.links}>
              {PROGRAM_LINKS.map(({ key, href }) => (
                <li key={key}>
                  <a
                    href={href}
                    onClick={(e) => handleFooterLink(e, href)}
                    className="text-sm text-white/65 transition duration-200 hover:text-white"
                  >
                    {t(key)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className={styles.linkGroup}>
            <p data-site-footer-label>
              {t("footer.companyHeading")}
            </p>
            <ul className={styles.links}>
              {COMPANY_LINKS.map(({ key, href }) => (
                <li key={key}>
                  <a
                    href={href}
                    onClick={(e) => handleFooterLink(e, href)}
                    className="text-sm text-white/65 transition duration-200 hover:text-white"
                  >
                    {t(key)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className={`${styles.linkGroup} ${styles.legal}`}>
            <p data-site-footer-label>
              {locale === "ar" ? "السياسات" : "Policies"}
            </p>
            <ul className={styles.links}>
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/65 transition duration-200 hover:text-[var(--orange-strong)]">
                    {locale === "ar" ? link.ar : link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className={styles.bottom}>
          <div data-site-footer-bottom className="flex flex-col items-center justify-between gap-2 text-center text-xs md:flex-row">
            <span>{t("footer.copyright")}</span>
            <span className={styles.poweredBy}>{t("footer.poweredBy")}</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
