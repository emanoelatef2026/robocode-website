"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import Reveal from "./Reveal";

const CARDS = [
  { icon: "🚀", titleKey: "why.card1Title", descKey: "why.card1Desc", accentCls: "bg-[#38BDF8]",  shadowHover: "" },
  { icon: "🤖", titleKey: "why.card2Title", descKey: "why.card2Desc", accentCls: "bg-[#38BDF8]",  shadowHover: "" },
  { icon: "🧠", titleKey: "why.card3Title", descKey: "why.card3Desc", accentCls: "bg-[#38BDF8]",  shadowHover: "" },
  { icon: "🏆", titleKey: "why.card4Title", descKey: "why.card4Desc", accentCls: "bg-[#FF8A1F]",  shadowHover: "md:hover:shadow-[0_20px_48px_rgba(255,138,31,0.13)]" },
] as const;

export default function WhySection() {
  const { t } = useLanguage();

  return (
    <Reveal>
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16 md:pb-32">

        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#38BDF8]">
            {t("why.eyebrow")}
          </p>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl md:text-6xl">
            {t("why.heading")}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base text-slate-700 md:mt-6 md:text-lg">
            {t("why.body")}
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:mt-20 md:grid-cols-2 md:gap-8">
          {CARDS.map(({ icon, titleKey, descKey, accentCls, shadowHover }) => (
            <div
              key={titleKey}
              className={`group rounded-2xl border border-white/50 bg-white/70 p-7 shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-2xl md:rounded-3xl md:p-10 md:hover:-translate-y-2 ${shadowHover}`}
            >
              <div className={`mb-5 flex h-13 w-13 items-center justify-center rounded-xl text-2xl text-white md:mb-6 md:h-16 md:w-16 md:rounded-2xl md:text-3xl ${accentCls}`}>
                {icon}
              </div>
              <h3 className="text-xl font-bold md:text-3xl">{t(titleKey)}</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-700 md:mt-4 md:text-lg">
                {t(descKey)}
              </p>
            </div>
          ))}
        </div>

      </section>
    </Reveal>
  );
}
