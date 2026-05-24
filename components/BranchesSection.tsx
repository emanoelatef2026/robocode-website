"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { ButtonLink } from "@/components/ui/Button";
import SectionEmptyState from "@/components/ui/SectionEmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Branch {
  id:         string;
  name:       string;
  phone:      string | null;
  location:   string | null;
  image_url:  string | null;
  active:     boolean;
  sort_order: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toWhatsApp(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, "");
}

function isOnlineBranch(b: Branch): boolean {
  return !b.location && !b.phone;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function BranchPanel({
  branch,
  t,
  dir,
}: {
  branch: Branch;
  t: (k: string) => string;
  dir: string;
}) {
  const online  = isOnlineBranch(branch);
  const xIn     = dir === "rtl" ? -16 : 16;
  const xOut    = dir === "rtl" ? 16 : -16;

  return (
    <motion.div
      key={branch.id}
      initial={{ opacity: 0, x: xIn }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: xOut }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col"
    >
      {/* Image / placeholder */}
      <div
        className="relative overflow-hidden rounded-2xl bg-[#0B1F3A]/6"
        style={{ aspectRatio: "16/9" }}
      >
        {branch.image_url ? (
          <Image
            src={branch.image_url}
            alt={branch.name}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 640px"
          />
        ) : online ? (
          /* Online branch placeholder */
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <svg viewBox="0 0 48 48" fill="none" className="h-12 w-12 text-[#38BDF8]/40">
              <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2" />
              <ellipse cx="24" cy="24" rx="8" ry="18" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 24h36M10 14h28M10 34h28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="rounded-full bg-[#38BDF8]/10 px-3 py-1 text-[11px] font-semibold text-[#38BDF8]">
              Online
            </span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg viewBox="0 0 48 48" fill="none" className="h-16 w-16 text-[#0B1F3A]/10">
              <rect x="4" y="4" width="40" height="40" rx="8" stroke="currentColor" strokeWidth="2" />
              <path d="M4 32l10-10 8 8 8-12 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className="text-2xl font-bold text-[#0B1F3A] md:text-3xl"
            style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
          >
            {branch.name}
          </h3>
          {online && (
            <span className="rounded-full bg-[#38BDF8]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#38BDF8]">
              Online
            </span>
          )}
        </div>

        {branch.phone && (
          <a
            href={`tel:${branch.phone}`}
            className="flex items-center gap-2.5 text-[#334155] transition hover:text-[#38BDF8]"
          >
            <span className="text-[#38BDF8]"><PhoneIcon /></span>
            <span className="text-sm font-medium">{branch.phone}</span>
          </a>
        )}

        {branch.location && (
          <div className="flex items-start gap-2.5 text-[#334155]">
            <span className="mt-0.5 text-[#FF8A1F]"><MapPinIcon /></span>
            <span className="text-sm leading-snug">{branch.location}</span>
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="mt-8 flex flex-wrap gap-3">
        {branch.phone && (
          <>
            {/* WhatsApp — primary */}
            <a
              href={`https://wa.me/${toWhatsApp(branch.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(37,211,102,0.28)] transition hover:-translate-y-0.5 hover:brightness-110"
            >
              <WhatsAppIcon />
              WhatsApp
            </a>

            {/* Call — secondary */}
            <a
              href={`tel:${branch.phone}`}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-bold text-[#0B1F3A] transition hover:-translate-y-0.5 hover:border-[#38BDF8] hover:text-[#38BDF8]"
            >
              <PhoneIcon />
              {t("branches.callNow")}
            </a>
          </>
        )}

        {branch.location && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(branch.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-bold text-[#0B1F3A] transition hover:-translate-y-0.5 hover:border-[#FF8A1F] hover:text-[#FF8A1F]"
          >
            <MapPinIcon />
            {t("branches.getDirections")}
          </a>
        )}

        <ButtonLink href="/book-session" variant="navy" className="!px-5 !py-2.5 !text-sm">
          {t("branches.bookTrialHere")}
        </ButtonLink>
      </div>
    </motion.div>
  );
}

// ── Desktop tab explorer ───────────────────────────────────────────────────────

function DesktopExplorer({
  branches,
  t,
  dir,
}: {
  branches: Branch[];
  t: (k: string) => string;
  dir: string;
}) {
  const [active, setActive] = useState(0);
  const branch = branches[active];

  return (
    <div
      className={`hidden overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-xl lg:flex ${dir === "rtl" ? "flex-row-reverse" : ""}`}
    >
      {/* Tab list */}
      <div
        className="flex w-60 shrink-0 flex-col bg-[#F8FAFC]"
        style={{ borderInlineEndWidth: "1px", borderColor: "#E2E8F0" }}
      >
        {branches.map((b, i) => {
          const isActive = i === active;
          const online   = isOnlineBranch(b);
          return (
            <button
              key={b.id}
              onClick={() => setActive(i)}
              className={[
                "relative flex items-center gap-3 px-5 py-4 transition-all duration-150",
                dir === "rtl" ? "text-right flex-row-reverse" : "text-left",
                isActive
                  ? "bg-white text-[#0B1F3A]"
                  : "text-[#64748B] hover:bg-white/70 hover:text-[#0B1F3A]",
              ].join(" ")}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span
                  className="absolute inset-y-0 w-0.75 rounded-full bg-[#38BDF8]"
                  style={{ [dir === "rtl" ? "right" : "left"]: 0 }}
                />
              )}

              {/* Avatar */}
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition ${
                  isActive ? "bg-[#38BDF8] text-white" : "bg-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {online ? "🌐" : b.name.charAt(0)}
              </span>

              <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug ${isActive ? "text-[#0B1F3A]" : ""}`}>
                {b.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className="flex-1 p-8">
        <AnimatePresence mode="wait">
          <BranchPanel key={branch.id} branch={branch} t={t} dir={dir} />
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Mobile accordion ──────────────────────────────────────────────────────────

function MobileAccordion({
  branches,
  t,
  dir,
}: {
  branches: Branch[];
  t: (k: string) => string;
  dir: string;
}) {
  const [open, setOpen] = useState<string | null>(branches[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-3 lg:hidden">
      {branches.map((b) => {
        const isOpen = open === b.id;
        const online = isOnlineBranch(b);

        return (
          <div
            key={b.id}
            className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
          >
            <button
              onClick={() => setOpen(isOpen ? null : b.id)}
              className={`flex w-full items-center justify-between gap-3 px-5 py-4 ${dir === "rtl" ? "flex-row-reverse text-right" : "text-left"}`}
            >
              <div className={`flex items-center gap-3 ${dir === "rtl" ? "flex-row-reverse" : ""}`}>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${
                    isOpen ? "bg-[#38BDF8] text-white" : "bg-[#F1F5F9] text-[#64748B]"
                  }`}
                >
                  {online ? "🌐" : b.name.charAt(0)}
                </span>
                <span className={`text-[14px] font-semibold ${isOpen ? "text-[#38BDF8]" : "text-[#0B1F3A]"}`}>
                  {b.name}
                </span>
              </div>

              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className={isOpen ? "text-[#38BDF8]" : "text-[#94A3B8]"}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[#E2E8F0] p-5">
                    <BranchPanel branch={b} t={t} dir={dir} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function BranchesSection() {
  const { t, dir }             = useLanguage();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((d) => { setBranches(Array.isArray(d) ? d : []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="branches" className="relative z-10 overflow-hidden py-16 md:py-28">

      {/* Background decoration */}
      <div className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-[#38BDF8]/5 blur-3xl" />
      <div className="pointer-events-none absolute left-0 bottom-0 h-80 w-80 rounded-full bg-[#0B1F3A]/4 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 text-center md:mb-14"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#FF8A1F]">
            {t("branches.eyebrow")}
          </p>
          <h2 className="mt-4 text-3xl font-bold text-[#0F172A] md:text-5xl lg:text-6xl">
            {t("branches.heading1")}{" "}
            <span className="text-[#38BDF8]">{t("branches.heading2")}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-[#334155] md:text-lg">
            {t("branches.body")}
          </p>
          <div className="mx-auto mt-6 h-0.75 w-14 rounded-full bg-[#FF8A1F]" />
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#38BDF8] border-t-transparent" />
          </div>
        ) : branches.length === 0 ? (
          <SectionEmptyState
            variant="branches"
            heading="Locations coming soon"
            subtext="We're expanding! Check back soon for Robocode branches near you."
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <DesktopExplorer branches={branches} t={t} dir={dir} />
            <MobileAccordion branches={branches} t={t} dir={dir} />
          </motion.div>
        )}
      </div>
    </section>
  );
}
