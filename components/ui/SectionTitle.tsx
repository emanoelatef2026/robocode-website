"use client";

import { motion } from "framer-motion";

interface SectionTitleProps {
  eyebrow: string;
  heading: React.ReactNode;
  body?:   string;
  center?: boolean;
  accent?: "orange" | "navy";
}

export default function SectionTitle({
  eyebrow,
  heading,
  body,
  center = true,
  accent = "orange",
}: SectionTitleProps) {
  const accentCls  = accent === "orange" ? "text-[#FF8A1F]" : "text-[#163560]";
  const dividerCls = accent === "orange"
    ? "from-[#FF8A1F] to-[#FFB15A]"
    : "from-[#0B1F3A] to-[#163560]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={center ? "text-center" : ""}
    >
      <p className={`text-[11px] font-bold uppercase tracking-[0.32em] ${accentCls}`}>
        {eyebrow}
      </p>

      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0F172A] md:text-5xl lg:text-6xl">
        {heading}
      </h2>

      {body && (
        <p className={`mt-5 text-base leading-relaxed text-[#334155] md:text-lg ${center ? "mx-auto max-w-2xl" : "max-w-2xl"}`}>
          {body}
        </p>
      )}

      <div className={`mt-6 h-0.75 w-14 rounded-full bg-linear-to-r ${dividerCls} ${center ? "mx-auto" : ""}`} />
    </motion.div>
  );
}
