"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Locale } from "@/lib/i18n";
import { publicButtonClass } from "./ui/Button";
import { PUBLIC_NAV_LINKS } from "@/lib/public-site/navigation";

const NAVBAR_OFFSET = 72;

// ── Language toggle ───────────────────────────────────────────────────────────

function LangToggle({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLanguage();

  const wrapCls = compact
    ? "flex items-center overflow-hidden rounded-full border border-[var(--border)] text-[11px] font-bold"
    : "flex w-full items-center overflow-hidden rounded-xl border border-[var(--border)] text-sm font-bold";

  const btnCls = (active: boolean) =>
    [
      "transition-all duration-200",
      compact ? "min-h-11 min-w-11 px-3 py-1.5" : "min-h-11 flex-1 py-2.5 text-center",
      active ? "bg-[var(--navy)] text-white" : "bg-white text-[var(--text-3)] hover:text-[var(--navy)]",
    ].join(" ");

  return (
    <div className={wrapCls}>
      <button aria-pressed={locale === "en"} onClick={() => setLocale("en" as Locale)} className={btnCls(locale === "en")}>
        EN
      </button>
      <span className="h-4 w-px shrink-0 bg-[var(--border)]" />
      <button aria-pressed={locale === "ar"} onClick={() => setLocale("ar" as Locale)} className={btnCls(locale === "ar")}>
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

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setMenuOpen(false); };
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Handles all nav link clicks:
  // – "/" on homepage  → smooth scroll to top
  // – "/#section" on homepage → smooth scroll to section
  // – anything on another page → let Next.js Link navigate normally
  const handleSectionClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (pathname !== "/") return; // off-homepage: let Link navigate

    if (href === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!href.startsWith("/#")) return;
    e.preventDefault();
    const el = document.getElementById(href.slice(2));
    if (!el) return;
    const navbarOffset = window.innerWidth >= 1024 ? 108 : NAVBAR_OFFSET;
    const top = el.getBoundingClientRect().top + window.scrollY - navbarOffset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  // Logo click: scroll to top if on homepage, navigate otherwise
  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
      className={[
        "fixed inset-x-0 top-0 z-50 transition-[background,box-shadow,border-color] duration-300",
        scrolled
          ? "border-b border-[var(--border)] bg-[var(--bg)] shadow-[var(--shadow-card)]"
          : "border-b border-[var(--border-soft)] bg-[var(--bg)]",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3">

        {/* Logo */}
        <Link
          href="/"
          aria-label="Robocode home"
          className="shrink-0"
          onClick={handleLogoClick}
        >
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
        <nav aria-label="Main navigation" className="hidden items-center gap-5 lg:flex">
          {PUBLIC_NAV_LINKS.map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              onClick={(e) => handleSectionClick(e, href)}
              className="group relative text-[13px] font-semibold text-[var(--text-3)] transition-colors duration-200 hover:text-[var(--navy)]"
            >
              {t(key)}
              <span className="absolute -bottom-0.5 inset-s-0 h-0.5 w-0 rounded-full bg-[var(--orange-strong)] transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        {/* Right controls: lang toggle + Login + CTA */}
        <div className="hidden items-center gap-3 lg:flex">
          <LangToggle compact />
          <Link href="/login">
            <motion.span
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={publicButtonClass("secondary")}
            >
              {t("nav.login")}
            </motion.span>
          </Link>
          <Link href="/book-session">
            <motion.span
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={publicButtonClass("primary")}
            >
              {t("nav.bookTrial")}
            </motion.span>
          </Link>
        </div>

        {/* Mobile right actions: Book Trial (primary) + Login + Hamburger */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <Link href="/book-session">
            <motion.span
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={publicButtonClass("primary", "!min-h-11 !px-3 !text-xs")}
            >
              {t("nav.bookTrialShort")}
            </motion.span>
          </Link>
          <Link href="/login">
            <motion.span
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={publicButtonClass("secondary", "!min-h-11 !px-3 !text-xs")}
            >
              {t("nav.login")}
            </motion.span>
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1.5 rounded-xl p-2"
          >
            <motion.span
              animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.22 }}
              className="block h-0.5 w-5 origin-center rounded-full bg-[var(--navy)]"
            />
            <motion.span
              animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.18 }}
              className="block h-0.5 w-5 rounded-full bg-[var(--navy)]"
            />
            <motion.span
              animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.22 }}
              className="block h-0.5 w-5 origin-center rounded-full bg-[var(--navy)]"
            />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="public-mobile-menu"
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            className="max-h-[calc(100dvh-80px)] overflow-y-auto border-t border-[var(--border)] bg-[var(--bg)] lg:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {PUBLIC_NAV_LINKS.map(({ key, href }) => (
                <Link
                  key={key}
                  href={href}
                  onClick={(e) => {
                    handleSectionClick(e, href);
                    setMenuOpen(false);
                  }}
                  className="rounded-xl px-4 py-3.5 text-[14px] font-semibold text-[var(--text-2)] transition-colors duration-150 hover:bg-[var(--orange-strong)]/8 hover:text-[var(--orange-strong)]"
                >
                  {t(key)}
                </Link>
              ))}

              {/* Language toggle */}
              <div className="mt-2">
                <LangToggle />
              </div>


              {/* Primary CTA — orange */}
              <Link
                href="/book-session"
                onClick={() => setMenuOpen(false)}
                className={publicButtonClass("primary", "mt-3 w-full")}
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
