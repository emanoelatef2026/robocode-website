"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import Reveal from "./Reveal";
import PublicSectionTitle from "./public-site/PublicSectionTitle";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WhyTab {
  id:        string;
  tab_name:  string;
  image_url: string;
}

interface WhySettings {
  section_title:    string;
  section_subtitle: string;
}

// ── Default tabs — shown before CMS is seeded ─────────────────────────────────

const DEFAULT_TABS: WhyTab[] = [
  { id: "default-1", tab_name: "Real Projects",               image_url: "" },
  { id: "default-2", tab_name: "AI & Future Skills",          image_url: "" },
  { id: "default-3", tab_name: "Competitions & Achievements", image_url: "" },
  { id: "default-4", tab_name: "Robotics & Engineering",      image_url: "" },
];

// ── Image placeholder ─────────────────────────────────────────────────────────

function WhyPlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
      <div className="flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--border)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 16l5-5 4 4 3-3 6 4" />
          <circle cx="8.5" cy="8.5" r="1.5" />
        </svg>
      </div>
      <p className="text-[12px] font-medium text-[var(--muted)]">No image uploaded</p>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function WhySection() {
  const { dir } = useLanguage();

  const [tabs,      setTabs]      = useState<WhyTab[]>(DEFAULT_TABS);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    fetch("/api/why-robocode")
      .then((r) => r.json())
      .then((d: { settings: WhySettings | null; tabs: WhyTab[] }) => {
        if (Array.isArray(d.tabs) && d.tabs.length > 0) {
          setTabs(d.tabs);
          setActiveIdx(0);
        }
      })
      .catch(() => {});
  }, []);

  const isRtl    = dir === "rtl";
  const activeTab = tabs[activeIdx];

  return (
    <Reveal>
      <section id="why" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-24">

        {/* ── Section header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 text-center"
        >
          <PublicSectionTitle section="why" />
        </motion.div>

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        {/*
          items-start: each column takes its own natural height.
          The image column owns the section height via aspect-[4/3] —
          the tabs column never stretches or shrinks the image.
          On mobile: flex-col → tabs on top, image on bottom.
        */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-col gap-5 lg:items-start lg:gap-8 ${isRtl ? "lg:flex-row-reverse" : "lg:flex-row"}`}
        >

          {/* ── Tabs — top on mobile, left on desktop ───────────────────── */}
          <div className="flex flex-col gap-3 lg:w-1/2">
            {tabs.map((tab, i) => (
              <motion.button
                key={tab.id}
                initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => { if (i !== activeIdx) setActiveIdx(i); }}
                className={[
                  "flex w-full items-center gap-5 rounded-[var(--radius-xl)] border px-6 py-5 text-left",
                  "shadow-[var(--shadow-card)] transition-all duration-300",
                  i === activeIdx
                    ? "border-[var(--orange-strong)] bg-white ring-2 ring-[var(--orange-strong)]/20"
                    : "border-[var(--border)] bg-white hover:border-[var(--orange-strong)]/50",
                ].join(" ")}
              >
                {/* Accent bar */}
                <div
                  className={[
                    "h-10 w-0.75 shrink-0 rounded-full transition-colors duration-300",
                    i === activeIdx ? "bg-[var(--orange-strong)]" : "bg-[var(--border)]",
                  ].join(" ")}
                />

                {/* Number badge */}
                <div
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    "text-[14px] font-bold transition-all duration-300",
                    i === activeIdx
                      ? "bg-[var(--orange-strong)] text-white"
                      : "bg-[var(--bg-muted)] text-[var(--muted)]",
                  ].join(" ")}
                >
                  {i + 1}
                </div>

                {/* Tab name */}
                <p
                  className={[
                    "flex-1 text-[15px] font-bold leading-snug transition-colors duration-200 md:text-[16px]",
                    i === activeIdx ? "text-[var(--text)]" : "text-[var(--text-3)]",
                  ].join(" ")}
                >
                  {tab.tab_name}
                </p>

                {/* Active chevron */}
                {i === activeIdx && (
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4 shrink-0 text-[var(--orange-strong)]"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </motion.button>
            ))}
          </div>

          {/* ── Image — bottom on mobile, right on desktop ──────────────── */}
          {/*
            aspect-[4/3] gives a fixed intrinsic height proportional to the
            column width. The image is never constrained by tab count.
            object-contain keeps the full image visible without any cropping.
          */}
          <div className="w-full lg:w-1/2">
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg)] shadow-[var(--shadow-card)]">
              <AnimatePresence mode="wait">
                {activeTab?.image_url ? (
                  <motion.div
                    key={activeTab.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={activeTab.image_url}
                      alt={activeTab.tab_name}
                      fill
                      className="object-contain"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      priority={activeIdx === 0}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key={`placeholder-${activeIdx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <WhyPlaceholder />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

        </motion.div>
      </section>
    </Reveal>
  );
}
