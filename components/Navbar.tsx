"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Locale } from "@/lib/i18n";

const NAVBAR_OFFSET = 72;

// ── Language toggle ───────────────────────────────────────────────────────────

function LangToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();

  const wrapCls = compact
    ? "flex items-center overflow-hidden rounded-full border border-[#E2E8F0] text-[11px] font-bold"
    : "flex w-full items-center overflow-hidden rounded-xl border border-[#E2E8F0] text-sm font-bold";

  const btnCls = (active: boolean) =>
    [
      "transition-all duration-200",
      compact ? "px-3 py-1.5" : "flex-1 py-2.5 text-center",
      active ? "bg-[#0B1F3A] text-white" : "bg-white text-[#64748B] hover:text-[#0B1F3A]",
    ].join(" ");

  return (
    <div className={wrapCls}>
      <button onClick={() => setLocale("en" as Locale)} className={btnCls(locale === "en")}>
        EN
      </button>
      <span className="h-4 w-px shrink-0 bg-[#E2E8F0]" />
      <button onClick={() => setLocale("ar" as Locale)} className={btnCls(locale === "ar")}>
        AR
      </button>
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const NAV_LINKS = [
    { key: "nav.home",         href: "/"              },
    { key: "nav.programs",     href: "/#programs"     },
    { key: "nav.projects",     href: "/#projects"     },
    { key: "nav.competitions", href: "/#competitions" },
    { key: "nav.branches",     href: "/#branches"     },
  ];

  const MOBILE_NAV_LINKS = [
    { key: "nav.home",             href: "/"                    },
    { key: "nav.why",              href: "/#why"                },
    { key: "nav.programs",         href: "/#programs"           },
    { key: "nav.learningJourney",  href: "/#learning-journey"   },
    { key: "nav.projects",         href: "/#projects"           },
    { key: "nav.competitions",     href: "/#competitions"       },
    { key: "nav.featuredStudents", href: "/#featured-students"  },
    { key: "nav.accreditations",   href: "/#accreditations"     },
    { key: "nav.partners",         href: "/#partners"           },
    { key: "nav.branches",         href: "/#branches"           },
  ];

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);

  const handleSectionClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (pathname !== "/" || !href.startsWith("/#")) return;
    e.preventDefault();
    const el = document.getElementById(href.slice(2));
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
      className={[
        "fixed inset-x-0 top-0 z-50 transition-[background,box-shadow,border-color] duration-300",
        scrolled
          ? "border-b border-[#E2E8F0] bg-white/95 shadow-[0_1px_12px_rgba(11,31,58,0.06)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">

        {/* Logo */}
        <Link href="/" aria-label="Robocode home" className="shrink-0">
          <Image
            src="/logo.png"
            alt="Robocode Logo"
            width={180}
            height={80}
            className="h-auto w-20 md:w-24"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              onClick={(e) => handleSectionClick(e, href)}
              className="group relative text-[13px] font-semibold text-[#64748B] transition-colors duration-200 hover:text-[#0B1F3A]"
            >
              {t(key)}
              {/* logical start-0 so underline slides from correct side in both LTR/RTL */}
              <span className="absolute -bottom-0.5 inset-s-0 h-0.5 w-0 rounded-full bg-[#FF8A1F] transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        {/* Right controls: lang toggle + CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <LangToggle compact />
          <Link href="/book-session">
            <motion.span
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="inline-flex items-center rounded-full bg-[#38BDF8] px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_2px_16px_rgba(56,189,248,0.35)] transition-shadow duration-300 hover:shadow-[0_4px_24px_rgba(56,189,248,0.5)]"
            >
              {t("nav.bookTrial")}
            </motion.span>
          </Link>
        </div>

        {/* Hamburger — mobile */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          className="flex flex-col justify-center gap-1.25 p-3 md:hidden"
        >
          <motion.span
            animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.22 }}
            className="block h-0.5 w-5 origin-center rounded-full bg-[#0B1F3A]"
          />
          <motion.span
            animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.18 }}
            className="block h-0.5 w-5 rounded-full bg-[#0B1F3A]"
          />
          <motion.span
            animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.22 }}
            className="block h-0.5 w-5 origin-center rounded-full bg-[#0B1F3A]"
          />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            className="overflow-hidden border-t border-[#E2E8F0] bg-white/98 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {MOBILE_NAV_LINKS.map(({ key, href }) => (
                <Link
                  key={key}
                  href={href}
                  onClick={(e) => {
                    handleSectionClick(e, href);
                    setMenuOpen(false);
                  }}
                  className="rounded-xl px-4 py-3.5 text-[14px] font-semibold text-[#334155] transition-colors duration-150 hover:bg-[#FF8A1F]/8 hover:text-[#FF8A1F]"
                >
                  {t(key)}
                </Link>
              ))}

              {/* Language toggle row */}
              <div className="mt-2">
                <LangToggle />
              </div>

              <Link
                href="/book-session"
                onClick={() => setMenuOpen(false)}
                className="mt-3 block w-full rounded-full bg-[#38BDF8] py-4 text-center text-sm font-bold text-white shadow-[0_2px_16px_rgba(56,189,248,0.3)] transition duration-200 hover:brightness-110"
              >
                {t("nav.bookFreeTrial")}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
