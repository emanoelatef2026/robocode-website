"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import Reveal from "./Reveal";

const STATS = [
  { value: "4+",     labelKey: "trust.yearsLabel",    color: "text-[#38BDF8]" },
  { value: "8000+",  labelKey: "trust.studentsLabel", color: "text-[#38BDF8]" },
  { value: "16000+", labelKey: "trust.parentsLabel",  color: "text-[#F97316]" },
  {
    value: "4.9",
    suffix: "/5",
    labelKey: "trust.ratingLabel",
    color: "text-[#38BDF8]",
  },
] as const;

export default function TrustSection() {
  const { t } = useLanguage();

  return (
    <Reveal>
      <section className="relative z-10 mx-auto mt-6 grid max-w-7xl grid-cols-2 gap-4 px-6 pb-16 md:mt-10 md:grid-cols-4 md:gap-6 md:pb-24">

        {STATS.map(({ value, labelKey, color, ...rest }) => (
          <div
            key={labelKey}
            className="flex flex-col items-center justify-center rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 md:rounded-3xl md:p-8 md:hover:-translate-y-2"
          >
            <h2 className={`text-4xl font-bold md:text-5xl ${color}`}>
              {value}
              {"suffix" in rest && rest.suffix && (
                <span className="text-2xl font-semibold text-slate-400 md:text-3xl">
                  {rest.suffix}
                </span>
              )}
            </h2>
            <p className="mt-2 text-xs font-semibold text-slate-500 md:text-sm">
              {t(labelKey)}
            </p>
          </div>
        ))}

      </section>
    </Reveal>
  );
}
