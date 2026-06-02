"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

const SOCIALS = [
  { label: "Facebook",  short: "Fb", href: "https://www.facebook.com/RobocodeSchool" },
  { label: "Instagram", short: "In", href: "https://www.instagram.com/robocode_school/" },
  { label: "LinkedIn",  short: "Li", href: "https://www.linkedin.com/company/robocode-school/?viewAsMember=true" },
  { label: "TikTok",    short: "Tk", href: "https://www.tiktok.com/@robocode_school" },
];

export default function Footer() {
  const { t } = useLanguage();
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
    { key: "footer.linkCompetitions", href: "/#competitions" },
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
    <footer className="relative z-10 bg-[#0B132B] text-white">
      <div className="mx-auto max-w-7xl px-6 pb-8 pt-14 md:pt-20">

        {/* Top grid */}
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <div className="lg:col-span-2">
            <Image
              src="/logo.png"
              alt="Robocode Logo"
              width={140}
              height={60}
              className="h-auto w-28 brightness-0 invert"
            />

            <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/60">
              {t("footer.tagline")}
            </p>

            <div className="mt-8 flex gap-3">
              {SOCIALS.map(({ label, short, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-[10px] font-semibold text-white/40 transition duration-200 hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
                >
                  {short}
                </a>
              ))}
            </div>
          </div>

          {/* Programs */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">
              {t("footer.programsHeading")}
            </p>
            <ul className="mt-5 space-y-3">
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
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">
              {t("footer.companyHeading")}
            </p>
            <ul className="mt-5 space-y-3">
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

        </div>

        {/* CTA banner */}
        <div className="mt-12 flex flex-col items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/4 px-6 py-8 md:mt-16 md:flex-row md:rounded-3xl md:px-10 md:py-10">
          <div className="border-s-2 border-[#FF8A1F]/50 ps-5 text-center md:text-start">
            <h3 className="text-lg font-bold md:text-2xl">
              {t("footer.ctaHeading")}
            </h3>
            <p className="mt-2 text-sm text-white/55">
              {t("footer.ctaSubtext")}
            </p>
          </div>
          <Link
            href="/book-session"
            className="shrink-0 rounded-full bg-[#FF8A1F] px-8 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(255,138,31,0.35)] transition duration-200 hover:brightness-110 hover:shadow-[0_8px_28px_rgba(255,138,31,0.45)]"
          >
            {t("footer.ctaButton")}
          </Link>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/[0.07] pt-6">
          <div className="flex flex-col items-center justify-between gap-2 text-center text-xs text-white/35 md:flex-row">
            <span>{t("footer.copyright")}</span>
            <span>{t("footer.poweredBy")}</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
