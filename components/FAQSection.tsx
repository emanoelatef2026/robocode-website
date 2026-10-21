"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import PublicSectionTitle from "./public-site/PublicSectionTitle";
import SectionEmptyState from "@/components/ui/SectionEmptyState";

const FAQ_CATEGORIES = [
  "All",
  "Programs",
  "Online Learning",
  "Robotics",
  "AI",
  "Competitions",
  "Trial Sessions",
  "Age Groups",
  "Certifications",
] as const;

interface FAQItem {
  id:       string;
  question: string;
  answer:   string;
  category: string;
}

// ── Accordion item ────────────────────────────────────────────────────────────

function FAQAccordionItem({ item, index }: { item: FAQItem; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45, delay: (index % 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start transition-colors duration-150 hover:bg-[var(--bg)]"
      >
        <span className="text-[14px] font-semibold leading-snug text-[var(--text)]">
          {item.question}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-3)]"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M8 3a1 1 0 011 1v3h3a1 1 0 110 2H9v3a1 1 0 11-2 0V9H4a1 1 0 110-2h3V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--bg-muted)] px-5 py-4">
              <p className="text-[13px] leading-relaxed text-[var(--text-2)]">{item.answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function FAQSection() {
  const { t }                           = useLanguage();
  const [items,    setItems]            = useState<FAQItem[]>([]);
  const [loading,  setLoading]          = useState(true);
  const [active,   setActive]           = useState<string>("All");

  useEffect(() => {
    fetch("/api/faq")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Inject FAQ schema.org JSON-LD for SEO
  useEffect(() => {
    if (items.length === 0) return;
    const existing = document.getElementById("faq-schema");
    if (existing) existing.remove();

    const script  = document.createElement("script");
    script.id     = "faq-schema";
    script.type   = "application/ld+json";
    script.text   = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type":          "Question",
        name:             item.question,
        acceptedAnswer:   { "@type": "Answer", text: item.answer },
      })),
    });
    document.head.appendChild(script);
    return () => { document.getElementById("faq-schema")?.remove(); };
  }, [items]);

  const filtered    = active === "All" ? items : items.filter((i) => i.category === active);
  const usedCategories = ["All", ...Array.from(new Set(items.map((i) => i.category)))];

  return (
    <section id="faq" className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-24">

      <PublicSectionTitle section="faq" />

      {loading ? (
        <div className="mt-10 flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--cyan-strong)] border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10">
          <SectionEmptyState
            variant="generic"
            heading="FAQ coming soon"
            subtext="Frequently asked questions will appear here once added."
          />
        </div>
      ) : (
        <>
          {/* Category filter tabs */}
          <div className="mt-8 flex flex-wrap gap-2 md:mt-10">
            {usedCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={[
                  "rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all duration-200",
                  active === cat
                    ? "bg-[var(--navy)] text-white shadow-sm"
                    : "border border-[var(--border)] bg-white text-[var(--text-3)] hover:border-[var(--cyan-strong)]/40 hover:text-[var(--navy)]",
                ].join(" ")}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Accordion list */}
          <div className="mt-6 grid gap-2.5 md:gap-3 lg:grid-cols-2">
            {filtered.map((item, i) => (
              <FAQAccordionItem key={item.id} item={item} index={i} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
