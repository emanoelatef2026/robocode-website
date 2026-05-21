"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { label: "Home",         href: "/"            },
  { label: "Programs",     href: "/#programs"   },
  { label: "Projects",     href: "/#projects"   },
  { label: "Competitions", href: "/#competitions"},
  { label: "Branches",     href: "/#branches"   },
];

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // On "/": intercept hash links and smooth-scroll without navigation.
  // On any other page: fall through → Next.js navigates to /#section naturally.
  const handleSectionClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (pathname !== "/" || !href.startsWith("/#")) return;
    e.preventDefault();
    document.getElementById(href.slice(2))?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }}
      className={[
        "fixed inset-x-0 top-0 z-50 transition-[background,box-shadow,border-color] duration-300",
        scrolled
          ? "border-b border-black/[0.07] bg-white/80 shadow-sm backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">

        {/* Logo → home */}
        <Link href="/" aria-label="Robocode home" className="shrink-0">
          <Image
            src="/logo.png"
            alt="Robocode Logo"
            width={180}
            height={80}
            className="h-auto w-30"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              onClick={(e) => handleSectionClick(e, href)}
              className="group relative text-[13.5px] font-semibold text-[#0B132B]/55 transition-colors duration-200 hover:text-[#0B132B]"
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
            className="inline-flex items-center rounded-full bg-[#19C6F4] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_rgba(25,198,244,0.35)] transition-shadow duration-300 hover:shadow-[0_0_28px_rgba(25,198,244,0.55)]"
          >
            Book Trial
          </motion.span>
        </Link>

        {/* Hamburger — mobile */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          className="flex flex-col justify-center gap-1.25 p-2 md:hidden"
        >
          <motion.span
            animate={menuOpen ? { rotate: 45, y: 5.5 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.22 }}
            className="block h-[1.5px] w-5 origin-center rounded-full bg-[#0B132B]"
          />
          <motion.span
            animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.18 }}
            className="block h-[1.5px] w-5 rounded-full bg-[#0B132B]"
          />
          <motion.span
            animate={menuOpen ? { rotate: -45, y: -5.5 } : { rotate: 0, y: 0 }}
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
            transition={{ duration: 0.26, ease: "easeInOut" }}
            className="overflow-hidden border-t border-black/6 bg-white/95 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-0.5 px-6 py-4">
              {NAV_LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  onClick={(e) => {
                    handleSectionClick(e, href);
                    setMenuOpen(false);
                  }}
                  className="rounded-xl px-3 py-3 text-[13.5px] font-semibold text-[#0B132B]/60 transition-colors duration-150 hover:bg-[#19C6F4]/6 hover:text-[#0B132B]"
                >
                  {label}
                </Link>
              ))}

              <Link
                href="/book-session"
                onClick={() => setMenuOpen(false)}
                className="mt-3 block w-full rounded-full bg-[#19C6F4] py-3 text-center text-sm font-semibold text-white shadow-[0_0_18px_rgba(25,198,244,0.3)] transition duration-200 hover:shadow-[0_0_24px_rgba(25,198,244,0.5)]"
              >
                Book Trial
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
