"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { label: "Home",         href: "/"             },
  { label: "Programs",     href: "/#programs"    },
  { label: "Projects",     href: "/#projects"    },
  { label: "Competitions", href: "/#competitions" },
  { label: "Branches",     href: "/#branches"    },
];

// Must match --navbar-offset in globals.css
const NAVBAR_OFFSET = 72;

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
  }, []);

  // On "/": smooth-scroll with proper navbar offset.
  // On any other page: fall through → Next.js navigates to /#section.
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
          ? "border-b border-black/[0.06] bg-white/85 shadow-[0_1px_0_rgba(0,0,0,0.05)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-2.5">

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
        <nav className="hidden items-center gap-5 md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={(e) => handleSectionClick(e, href)}
              className="group relative text-[13px] font-semibold text-[#0B132B]/50 transition-colors duration-200 hover:text-[#0B132B]"
            >
              {label}
              <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 rounded-full bg-[#19C6F4] transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        {/* CTA — desktop */}
        <Link href="/book-session" className="hidden md:inline-flex">
          <motion.span
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="inline-flex items-center rounded-full bg-[#19C6F4] px-5 py-2 text-[13px] font-semibold text-white shadow-[0_0_16px_rgba(25,198,244,0.32)] transition-shadow duration-300 hover:shadow-[0_0_26px_rgba(25,198,244,0.52)]"
          >
            Book Trial
          </motion.span>
        </Link>

        {/* Hamburger — mobile */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          className="flex flex-col justify-center gap-[5px] p-3 md:hidden"
        >
          <motion.span
            animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.22 }}
            className="block h-[1.5px] w-5 origin-center rounded-full bg-[#0B132B]"
          />
          <motion.span
            animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.18 }}
            className="block h-[1.5px] w-5 rounded-full bg-[#0B132B]"
          />
          <motion.span
            animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.22 }}
            className="block h-[1.5px] w-5 origin-center rounded-full bg-[#0B132B]"
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
            className="overflow-hidden border-t border-black/[0.05] bg-white/96 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {NAV_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={(e) => {
                    handleSectionClick(e, href);
                    setMenuOpen(false);
                  }}
                  className="rounded-xl px-4 py-3.5 text-[14px] font-semibold text-[#0B132B]/55 transition-colors duration-150 hover:bg-[#19C6F4]/6 hover:text-[#0B132B]"
                >
                  {label}
                </Link>
              ))}

              <Link
                href="/book-session"
                onClick={() => setMenuOpen(false)}
                className="mt-3 block w-full rounded-full bg-[#19C6F4] py-4 text-center text-sm font-semibold text-white shadow-[0_0_18px_rgba(25,198,244,0.28)] transition duration-200 hover:shadow-[0_0_24px_rgba(25,198,244,0.48)]"
              >
                Book Free Trial
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
