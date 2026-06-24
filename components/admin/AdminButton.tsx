"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

// ── Variants ──────────────────────────────────────────────────────────────────

const VARIANTS = {
  primary:   "ds-btn-primary",
  orange:    "ds-btn-orange",
  ghost:     "ds-btn-ghost",
  danger:    "inline-flex items-center gap-2 rounded-[10px] bg-[#DC2626] text-white text-[13px] font-semibold px-4 py-2 border-none cursor-pointer transition hover:bg-[#b91c1c]",
  icon:      "inline-flex items-center justify-center w-9 h-9 rounded-[10px] border border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#94A3B8] hover:text-[#0B1F3A] transition cursor-pointer",
} as const;

type Variant = keyof typeof VARIANTS;

// ── ButtonLink ─────────────────────────────────────────────────────────────────

interface LinkProps extends ComponentPropsWithoutRef<"a"> {
  variant?: Variant;
  href:     string;
}

export function AdminButtonLink({ variant = "primary", href, className = "", children, ...props }: LinkProps) {
  return (
    <Link href={href} className={`${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}

// ── Button ─────────────────────────────────────────────────────────────────────

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: Variant;
}

export default function AdminButton({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  return (
    <button className={`${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
