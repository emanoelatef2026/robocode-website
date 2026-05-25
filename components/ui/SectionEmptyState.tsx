"use client";

import { motion } from "framer-motion";

// ── Illustration variants ─────────────────────────────────────────────────────

function BranchIllustration() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
      <circle cx="32" cy="32" r="28" fill="#0B1F3A" fillOpacity=".06" />
      <path fillRule="evenodd" clipRule="evenodd"
        d="M32 18a9 9 0 100 18 9 9 0 000-18zm0 2a7 7 0 110 14 7 7 0 010-14z"
        fill="#38BDF8" fillOpacity=".5"
      />
      <path d="M32 35c-8 0-14 4-14 9h28c0-5-6-9-14-9z" fill="#38BDF8" fillOpacity=".25" />
      <circle cx="32" cy="25" r="3" fill="#38BDF8" fillOpacity=".7" />
    </svg>
  );
}

function StudentsIllustration() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
      <circle cx="32" cy="32" r="28" fill="#0B1F3A" fillOpacity=".06" />
      <circle cx="24" cy="26" r="6" fill="#38BDF8" fillOpacity=".4" />
      <circle cx="40" cy="26" r="6" fill="#38BDF8" fillOpacity=".25" />
      <path d="M14 44c0-5.5 4.5-10 10-10h16c5.5 0 10 4.5 10 10" stroke="#38BDF8" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ProjectsIllustration() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
      <circle cx="32" cy="32" r="28" fill="#0B1F3A" fillOpacity=".06" />
      <rect x="16" y="20" width="32" height="24" rx="4" fill="#0B1F3A" fillOpacity=".08" />
      <path d="M16 28h32" stroke="#38BDF8" strokeOpacity=".5" strokeWidth="1.5" />
      <circle cx="21" cy="24" r="1.5" fill="#FF8A1F" fillOpacity=".6" />
      <circle cx="26" cy="24" r="1.5" fill="#38BDF8" fillOpacity=".6" />
      <path d="M22 36h20M22 40h14" stroke="#38BDF8" strokeOpacity=".5" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GenericIllustration() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
      <circle cx="32" cy="32" r="28" fill="#0B1F3A" fillOpacity=".06" />
      <path d="M22 32h20M32 22v20" stroke="#38BDF8" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="32" r="8" stroke="#38BDF8" strokeOpacity=".35" strokeWidth="1.5" />
    </svg>
  );
}

function ReviewsIllustration() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
      <circle cx="32" cy="32" r="28" fill="#0B1F3A" fillOpacity=".06" />
      <path d="M18 28h28v14a2 2 0 01-2 2H20a2 2 0 01-2-2V28z" fill="#38BDF8" fillOpacity=".12" />
      <path d="M18 28v-4a2 2 0 012-2h24a2 2 0 012 2v4H18z" fill="#0B1F3A" fillOpacity=".08" />
      <path d="M24 36h4M24 40h8" stroke="#38BDF8" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M40 34l1.5 3 3.5.5-2.5 2.5.5 3.5L40 42l-3 1.5.5-3.5L35 37.5l3.5-.5L40 34z" fill="#FF8A1F" fillOpacity=".5" />
    </svg>
  );
}

function PartnersIllustration() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
      <circle cx="32" cy="32" r="28" fill="#0B1F3A" fillOpacity=".06" />
      <rect x="14" y="26" width="15" height="10" rx="3" fill="#38BDF8" fillOpacity=".2" />
      <rect x="35" y="26" width="15" height="10" rx="3" fill="#0B1F3A" fillOpacity=".1" />
      <path d="M29 31h6" stroke="#38BDF8" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="22" cy="31" r="2" fill="#38BDF8" fillOpacity=".5" />
      <circle cx="43" cy="31" r="2" fill="#0B1F3A" fillOpacity=".2" />
    </svg>
  );
}

function AccreditationsIllustration() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
      <circle cx="32" cy="32" r="28" fill="#0B1F3A" fillOpacity=".06" />
      <path d="M32 16l2.9 8.9H44l-7.6 5.5 2.9 8.9L32 34l-7.3 5.3 2.9-8.9L20 24.9h9.1L32 16z" fill="#FF8A1F" fillOpacity=".35" />
      <circle cx="32" cy="32" r="8" stroke="#38BDF8" strokeOpacity=".4" strokeWidth="1.5" />
      <path d="M28 32l2.5 2.5L36 29" stroke="#38BDF8" strokeOpacity=".7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BlogIllustration() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
      <circle cx="32" cy="32" r="28" fill="#0B1F3A" fillOpacity=".06" />
      <rect x="16" y="18" width="32" height="28" rx="3" fill="#0B1F3A" fillOpacity=".07" />
      <rect x="16" y="18" width="32" height="9" rx="3" fill="#38BDF8" fillOpacity=".18" />
      <path d="M20 34h24M20 38h16M20 42h20" stroke="#38BDF8" strokeOpacity=".5" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FAQIllustration() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
      <circle cx="32" cy="32" r="28" fill="#0B1F3A" fillOpacity=".06" />
      <circle cx="32" cy="32" r="12" stroke="#38BDF8" strokeOpacity=".35" strokeWidth="1.5" />
      <path d="M29 28.5c0-1.7 1.3-3 3-3s3 1.3 3 3c0 1.3-.8 2.4-2 2.8V34" stroke="#38BDF8" strokeOpacity=".7" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="37" r="1" fill="#38BDF8" fillOpacity=".7" />
    </svg>
  );
}

const ILLUSTRATIONS = {
  branches:        BranchIllustration,
  students:        StudentsIllustration,
  projects:        ProjectsIllustration,
  reviews:         ReviewsIllustration,
  partners:        PartnersIllustration,
  accreditations:  AccreditationsIllustration,
  blog:            BlogIllustration,
  faq:             FAQIllustration,
  generic:         GenericIllustration,
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

interface SectionEmptyStateProps {
  variant?: keyof typeof ILLUSTRATIONS;
  heading: string;
  subtext?: string;
}

export default function SectionEmptyState({
  variant = "generic",
  heading,
  subtext,
}: SectionEmptyStateProps) {
  const Illustration = ILLUSTRATIONS[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-sm py-12 text-center"
    >
      <div className="mx-auto mb-5 flex items-center justify-center">
        <Illustration />
      </div>

      <p className="text-[15px] font-semibold text-[#0B1F3A]">{heading}</p>

      {subtext && (
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-[#94A3B8]">{subtext}</p>
      )}

      <div className="mx-auto mt-5 h-0.5 w-10 rounded-full bg-[#38BDF8]/30" />
    </motion.div>
  );
}
