"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import Reveal from "./Reveal";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconAdaptive() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="5"  cy="12" r="2" />
      <circle cx="19" cy="5"  r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M7 12h4m4-5H9m6 7H9" />
      <path d="M11 12l6-5M11 12l6 5" />
    </svg>
  );
}

function IconProjects() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function IconBeyond() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M8 21h8m-4-3v3" />
      <path d="M5.5 8.5c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5c0 2.41-1.32 4.5-3.26 5.67L16 18H8l.76-3.83C6.82 13 5.5 10.91 5.5 8.5z" />
    </svg>
  );
}

function IconSkills() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 2a7 7 0 017 7c0 2.66-1.47 4.97-3.64 6.22L15 18H9l-.36-2.78A7 7 0 015 9a7 7 0 017-7z" />
      <path d="M9 21h6" />
      <path d="M12 6v3m0 0l2 2m-2-2l-2 2" />
    </svg>
  );
}

// ── Feature data ──────────────────────────────────────────────────────────────

const FEATURES = [
  { titleKey: "why.tab1Title", tagKey: "why.tab1Tag", icon: <IconAdaptive /> },
  { titleKey: "why.tab2Title", tagKey: "why.tab2Tag", icon: <IconProjects /> },
  { titleKey: "why.tab3Title", tagKey: "why.tab3Tag", icon: <IconBeyond />  },
  { titleKey: "why.tab4Title", tagKey: "why.tab4Tag", icon: <IconSkills />  },
] as const;

// ── Image placeholder ─────────────────────────────────────────────────────────

function WhyPlaceholder() {
  return (
    <div className="relative h-full w-full bg-[#0B1F3A]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-size-[48px_48px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#38BDF8]/8 blur-3xl" />
      <div className="absolute inset-0 flex items-center justify-center opacity-20">
        <svg viewBox="0 0 48 48" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16">
          <rect x="4" y="4" width="40" height="40" rx="6" />
          <path d="M4 30l10-10 8 8 8-12 14 14" />
          <circle cx="16" cy="16" r="4" />
        </svg>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function WhySection() {
  const { t, dir }                    = useLanguage();
  const [whyImageUrl, setWhyImageUrl] = useState<string>("");

  useEffect(() => {
    fetch("/api/site-media?key=why_robocode_image")
      .then((r) => r.json())
      .then((d: { image_url?: string } | null) => { if (d?.image_url) setWhyImageUrl(d.image_url); })
      .catch(() => {});
  }, []);

  const isRtl = dir === "rtl";

  return (
    <Reveal>
      <section id="why" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-24">

        {/* ── Section header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 text-center md:mb-14"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#38BDF8]">
            {t("why.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0F172A] md:text-5xl lg:text-6xl">
            {t("why.heading")}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#334155] md:text-lg">
            {t("why.body")}
          </p>
          <div className="mx-auto mt-6 h-0.75 w-14 rounded-full bg-[#38BDF8]" />
        </motion.div>

        {/* ── 50 / 50 editorial layout ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-col gap-5 lg:items-stretch lg:gap-8 ${isRtl ? "lg:flex-row-reverse" : "lg:flex-row"}`}
        >

          {/* ── LEFT: 4 static feature frames ─────────────────────────── */}
          <div className="flex flex-col gap-3 lg:w-1/2">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.titleKey}
                initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 items-center gap-5 rounded-2xl border border-[#E2E8F0] bg-white px-6 py-5 shadow-[0_2px_12px_rgba(11,31,58,0.05)]"
              >
                {/* Cyan accent bar */}
                <div className="h-10 w-0.75 shrink-0 rounded-full bg-[#38BDF8]" />

                {/* Icon */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#0B1F3A]">
                  {feature.icon}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-snug text-[#0F172A] md:text-[16px]">
                    {t(feature.titleKey)}
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium text-[#64748B] md:text-[13px]">
                    {t(feature.tagKey)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── RIGHT: static CMS-managed image ───────────────────────── */}
          <div className="order-first h-64 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_4px_32px_rgba(11,31,58,0.08)] sm:h-80 lg:order-0 lg:h-auto lg:w-1/2">
            <div className="relative h-full w-full">
              {whyImageUrl ? (
                <Image
                  src={whyImageUrl}
                  alt="Why Robocode"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              ) : (
                <WhyPlaceholder />
              )}
            </div>
          </div>

        </motion.div>
      </section>
    </Reveal>
  );
}
