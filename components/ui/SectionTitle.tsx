"use client";

import { motion } from "framer-motion";

interface SectionTitleProps {
  eyebrow?: string;
  heading:  React.ReactNode;
  body?:    string;
  center?:  boolean;
  accent?:  "orange" | "navy";
}

export default function SectionTitle({
  eyebrow,
  heading,
  body,
  center = true,
  accent = "orange",
}: SectionTitleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={center ? "text-center" : ""}
    >
      {eyebrow && (
        <p className={`mb-3 text-[11px] font-bold uppercase tracking-[0.28em] ${accent === "orange" ? "text-[#FF8A1F]" : "text-[#0B2341]"}`}>
          {eyebrow}
        </p>
      )}

      {/* H2 — brand navy, consistent scale across all sections */}
      <h2 className="text-3xl font-bold tracking-tight text-[#0B2341] md:text-4xl">
        {heading}
      </h2>

      {body && (
        <p className={`mt-4 text-base leading-relaxed text-[#64748B] ${center ? "mx-auto max-w-2xl" : "max-w-2xl"}`}>
          {body}
        </p>
      )}
    </motion.div>
  );
}
