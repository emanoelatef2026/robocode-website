"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import Reveal from "./Reveal";

// ── Icons ─────────────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 15.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "6+",     labelKey: "trust.yearsLabel",    iconColor: "text-[#38BDF8]", icon: <ClockIcon /> },
  { value: "8000+",  labelKey: "trust.studentsLabel", iconColor: "text-[#38BDF8]", icon: <UsersIcon /> },
  { value: "16000+", labelKey: "trust.parentsLabel",  iconColor: "text-[#FF8A1F]", icon: <HeartIcon /> },
  { value: "4.9",    suffix: "/5", labelKey: "trust.ratingLabel", iconColor: "text-[#38BDF8]", icon: <StarIcon /> },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrustSection() {
  const { t } = useLanguage();

  return (
    <Reveal>
      <section className="relative z-10 mx-auto grid max-w-7xl grid-cols-2 gap-4 px-6 pb-16 pt-2 md:grid-cols-4 md:gap-6 md:pb-24 md:pt-4">

        {STATS.map(({ value, labelKey, iconColor, icon, ...rest }) => (
          <div
            key={labelKey}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/40 bg-white/70 px-4 py-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 md:rounded-3xl md:py-8 md:hover:-translate-y-2"
          >
            <span className={iconColor}>{icon}</span>

            <h2 className="text-4xl font-bold text-[#0F172A] md:text-5xl">
              {value}
              {"suffix" in rest && rest.suffix && (
                <span className="text-2xl font-semibold text-[#94A3B8] md:text-3xl">
                  {rest.suffix}
                </span>
              )}
            </h2>

            <p className="text-center text-xs font-semibold text-[#334155] md:text-sm">
              {t(labelKey)}
            </p>
          </div>
        ))}

      </section>
    </Reveal>
  );
}
