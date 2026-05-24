"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

// ── Variants ──────────────────────────────────────────────────────────────────

const VARIANTS = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-[#38BDF8] px-7 py-3.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(56,189,248,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_8px_32px_rgba(56,189,248,0.45)] active:translate-y-0 active:shadow-none",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#E2E8F0] bg-white px-7 py-3.5 text-sm font-bold text-[#0B1F3A] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#38BDF8] hover:text-[#38BDF8] hover:shadow-[0_4px_16px_rgba(56,189,248,0.12)] active:translate-y-0",
  navy:
    "inline-flex items-center justify-center gap-2 rounded-full bg-[#0B1F3A] px-7 py-3.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(11,31,58,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#163560] hover:shadow-[0_8px_32px_rgba(11,31,58,0.3)] active:translate-y-0",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-[#0B1F3A] transition-all duration-300 hover:bg-[#38BDF8]/8 hover:text-[#38BDF8]",
} as const;

type Variant = keyof typeof VARIANTS;

// ── Link button ───────────────────────────────────────────────────────────────

interface ButtonLinkProps extends ComponentPropsWithoutRef<"a"> {
  variant?: Variant;
  href:     string;
  external?: boolean;
}

export function ButtonLink({
  variant = "primary",
  href,
  external,
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  const cls = `${VARIANTS[variant]} ${className}`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: Variant;
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
